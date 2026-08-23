import { SETU_DEFAULT_USER_AGENT } from './constants.js';

let setuLocalBackoff = {
    blockedUntil: 0,
    reason: ''
};

export function getSetuBackoffStatus(config = null) {
    const now = Date.now();
    let blockedUntil = setuLocalBackoff.blockedUntil || 0;
    if (config && config.wafBlockedUntil && config.wafBlockedUntil > blockedUntil) {
        blockedUntil = config.wafBlockedUntil;
        setuLocalBackoff.blockedUntil = blockedUntil;
    }
    const isBlocked = blockedUntil > now;
    const remainingSeconds = isBlocked ? Math.ceil((blockedUntil - now) / 1000) : 0;
    return {
        isBlocked,
        blockedUntil,
        remainingSeconds,
        message: isBlocked ? 'System busy, please try again in a few minutes' : null
    };
}

export function activateSetuBackoff(durationMs = 15 * 60 * 1000, reason = 'WAF/RateLimit', connection = null, config = null) {
    const blockedUntil = Date.now() + durationMs;
    setuLocalBackoff.blockedUntil = blockedUntil;
    setuLocalBackoff.reason = reason;

    if (config) {
        config.wafBlockedUntil = blockedUntil;
    }
    if (connection && config) {
        connection.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']).catch(() => {});
    }
    console.warn(`[Setu Back-Off Activated] Local cache & DB locked for ${Math.ceil(durationMs / 60000)} minutes. Reason: ${reason}`);
    return blockedUntil;
}

export function clearSetuBackoff(connection = null, config = null) {
    setuLocalBackoff.blockedUntil = 0;
    setuLocalBackoff.reason = '';
    if (config && config.wafBlockedUntil) {
        delete config.wafBlockedUntil;
        if (connection) {
            connection.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']).catch(() => {});
        }
    }
}

export function getSetuHeaders(token = null, schemeId = null, extraHeaders = {}) {
    const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': SETU_DEFAULT_USER_AGENT,
        'Cache-Control': 'no-cache',
        ...extraHeaders
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (schemeId) {
        headers['X-Setu-Product-Instance-ID'] = schemeId;
    }
    return headers;
}

// Helper to obtain or refresh Setu OAuth token with auto-retry and cache handling
export async function getSetuToken(connection, config, forceRefresh = false, allowWafBypass = false) {
    const now = Math.floor(Date.now() / 1000);
    const mode = (config.mode || 'PRODUCTION').toUpperCase();
    const isProduction = mode === 'PRODUCTION' || mode === 'PROD';
    const baseUrl = isProduction ? 'https://prod.setu.co/api/v2' : 'https://uat.setu.co/api/v2';

    const clientId = config.clientId || config.clientID || config.client_id;
    const secret = config.secret || config.clientSecret || config.client_secret;

    const isInvalidCredential = (val) => !val || typeof val !== 'string' || val.trim() === '' || val.includes('default') || val.includes('YOUR_SETU');
    if (isInvalidCredential(clientId) || isInvalidCredential(secret) || config.enabled === false) {
        throw new Error("Setu Integration is not configured with valid credentials in Settings.");
    }

    if (allowWafBypass || forceRefresh) {
        clearSetuBackoff(connection, config);
    }

    if (!forceRefresh && config.cachedToken && config.tokenExpiresAt && config.tokenExpiresAt > (now + 60)) {
        return config.cachedToken;
    }

    console.log(`[Setu Token Manager] Fetching new OAuth token from ${baseUrl} (Force refresh: ${forceRefresh})...`);
    let tokenResponse;
    try {
        tokenResponse = await fetch(`${baseUrl}/auth/token`, {
            method: 'POST',
            headers: getSetuHeaders(null, null, { 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                clientID: clientId,
                secret: secret
            })
        });
    } catch (fetchErr) {
        console.warn(`[Setu Token Manager] Network request to Setu failed: ${fetchErr.message}`);
        const err = new Error("System busy, please try again in a few minutes");
        err.status = 503;
        err.isBlocked = true;
        throw err;
    }

    const tokenText = await tokenResponse.text();
    let tokenData;
    try {
        tokenData = JSON.parse(tokenText);
    } catch (e) {
        const isHtml = tokenText.trim().toLowerCase().startsWith('<!doctype') || 
                      tokenText.trim().toLowerCase().startsWith('<html') ||
                      tokenText.includes('<!-- a padding to disable MSIE');
        
        if (isHtml) {
            activateSetuBackoff(5 * 60 * 1000, 'WAF_HTML_Page', connection, config);
        }

        const summary = isHtml ? "HTML Error Page (Cloudflare/WAF block or invalid endpoint)" : tokenText.substring(0, 150);
        console.warn(`[Setu Token Manager] Setu returned HTTP ${tokenResponse.status}: ${summary}`);
        const err = new Error("System busy, please try again in a few minutes");
        err.rawResponse = tokenText;
        err.status = 503;
        err.isBlocked = true;
        throw err;
    }

    if (!tokenResponse.ok || !tokenData.success) {
        if (tokenResponse.status === 429) {
            activateSetuBackoff(5 * 60 * 1000, `HTTP_429_RateLimit`, connection, config);
            const err = new Error("System busy, please try again in a few minutes");
            err.status = 503;
            err.isBlocked = true;
            throw err;
        }
        console.warn(`[Setu Token Manager] Auth Response Error (Status ${tokenResponse.status}):`, tokenData.error?.message || tokenText);
        const err = new Error(tokenData.error?.message || tokenData.error?.detail || tokenData.message || "Setu Authentication Failed");
        err.response = { status: tokenResponse.status, data: tokenData };
        err.rawResponse = tokenText;
        err.status = tokenResponse.status;
        throw err;
    }

    const token = tokenData.data.token;
    const expiresIn = tokenData.data.expiresIn || 1800;
    
    config.cachedToken = token;
    config.tokenExpiresAt = now + expiresIn;
    clearSetuBackoff(connection, config);
    
    if (connection) {
        try {
            await connection.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'setu']);
        } catch (dbErr) {}
    }
    console.log(`[Setu Token Manager] New token cached successfully. Expires in ${expiresIn}s`);
    return token;
}
