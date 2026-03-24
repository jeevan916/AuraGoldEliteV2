
import { getPool } from './db.js';
import https from 'https';
import http from 'http';
import { sendWhatsAppMessage } from './whatsapp.js';
import { io as ioClient } from 'socket.io-client';

let backgroundInterval = null;
let currentIntervalMins = null;
let io = null;
let socketClient = null;

// Configuration for Rate Providers (Priority Order)
// Updated: Batuk (Augmont) is now the primary source.
const PROVIDERS = [
    { 
        id: 'batuk', 
        name: 'Batuk (Augmont)', 
        url: 'https://uat.batuk.in/augmont/gold' 
    },
    { 
        id: 'sagar', 
        name: 'Sagar Jewellers', 
        url: 'https://bcast.sagarjewellers.co.in:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/sagar' 
    }
];

export const setRateServiceIo = (socketIo) => {
    io = socketIo;
};

export const initSocketRates = (serverUrl, apiKey) => {
    console.log(`[RateService] Initializing socket rates with URL: ${serverUrl}`);
    console.log(`[RateService] API Key provided: ${apiKey ? 'Yes' : 'No'}`);
    if (!serverUrl || !apiKey) {
        console.error("[RateService] Missing serverUrl or apiKey");
        return;
    }
    if (socketClient) socketClient.disconnect();
    
    socketClient = ioClient(serverUrl, {
        auth: { token: apiKey },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 20000
    });

    socketClient.on('connect', () => {
        console.log('[RateService] Connected to external live rates stream');
    });

    socketClient.on('rates', async (data) => {
        console.log('[RateService] Received rates from external stream');
        // Assuming data structure matches RatesPayload
        // Need to map this to the gold_rates table structure
        // rate24k, rate22k, rate18k, rateSilver
        // The payload has goldRates and silverRates which are arrays of RateItem
        
        // This is a simplification, need to map correctly
        const gold24k = data.goldRates.find(r => r.name.includes('24K'))?.ask || 0;
        const gold22k = data.goldRates.find(r => r.name.includes('22K'))?.ask || 0;
        const gold18k = data.goldRates.find(r => r.name.includes('18K'))?.ask || 0;
        const silver = data.silverRates.find(r => r.name.includes('Silver'))?.ask || 0;

        try {
            const pool = getPool();
            const connection = await pool.getConnection();
            await connection.query(
                'INSERT INTO gold_rates (rate24k, rate22k, rate18k, rateSilver) VALUES (?, ?, ?, ?)',
                [gold24k, gold22k, gold18k, silver]
            );
            connection.release();
            if (io) io.emit('rates', { rate24k: gold24k, rate22k: gold22k, rate18k: gold18k, rateSilver: silver, recorded_at: new Date() });
        } catch (e) {
            console.error("[RateService] Error saving socket rates:", e.message);
        }
    });

    socketClient.on('connect_error', (err) => {
        console.error('[RateService] External stream connection error:', err.message);
        if (err.description) console.error('[RateService] Error description:', err.description);
        if (err.context) console.error('[RateService] Error context:', err.context);
    });
};

// Helper for robust fetching from legacy servers (ignores SSL errors, follows redirects)
const fetchInsecure = (url, depth = 0) => {
    if (depth > 5) return Promise.reject(new Error("Too many redirects"));

    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https');
        const lib = isHttps ? https : http;
        
        const request = lib.get(url, {
            rejectUnauthorized: false, // Bypass SSL for legacy servers
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,image/webp,*/*;q=0.8',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
            },
            timeout: 15000 // 15s timeout per provider
        }, (res) => {
            // Handle Redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const newUrl = new URL(res.headers.location, url).href;
                res.resume();
                fetchInsecure(newUrl, depth + 1).then(resolve).catch(reject);
                return;
            }

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });
        });

        request.on('error', (err) => reject(err));
        request.on('timeout', () => {
            request.destroy();
            reject(new Error("Request Timeout (15s)"));
        });
    });
};

// Helper to recursively find values in JSON by regex key matching
const findJsonValue = (obj, keyRegex) => {
    if (!obj || typeof obj !== 'object') return null;
    
    // 1. Direct key match
    for (const key of Object.keys(obj)) {
        if (keyRegex.test(key)) {
            const val = obj[key];
            // If value is object, maybe nested 'sell'/'buy' inside?
            if (typeof val === 'object' && val !== null) {
                // Heuristic: Prefer 'sell', then 'rate', then 'price', then generic
                if (val.sell) return val.sell;
                if (val.rate) return val.rate;
                if (val.price) return val.price;
                if (val.value) return val.value;
                // recursive dive
                const nested = findJsonValue(val, keyRegex); 
                if (nested) return nested;
            } else {
                return val;
            }
        }
    }

    // 2. Deep search
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') {
            const result = findJsonValue(obj[key], keyRegex);
            if (result) return result;
        }
    }
    return null;
};

/**
 * Fetches gold rate from external APIs with Failover Strategy.
 * @param {string|null} forcedProviderId - If set, only this provider is queried.
 */
export async function fetchAndSaveRate(forcedProviderId = null) {
    console.log(`[RateService] Executing fetch${forcedProviderId ? ` (Forced: ${forcedProviderId})` : ''}: ${new Date().toISOString()}`);
    
    let successData = null;
    let lastError = null;
    let winningProvider = null;

    let targetProviders = PROVIDERS;

    if (forcedProviderId) {
        targetProviders = PROVIDERS.filter(p => p.id === forcedProviderId);
    } else {
        // Read preference from DB to reorder or filter default list
        try {
            const pool = getPool();
            if (pool) {
                const connection = await pool.getConnection();
                const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['core_settings']);
                connection.release();
                if (rows.length > 0) {
                    const config = JSON.parse(rows[0].config);
                    const pref = config.preferredRateProvider; // 'batuk' | 'sagar' | 'auto'
                    if (pref && pref !== 'auto') {
                        // Priority Reordering: Put preferred first, but keep others as fallback if explicit setting implies preference not exclusivity.
                        // However, user usually implies "Use this one". 
                        // Let's force it to be the first one tried.
                        const pIndex = PROVIDERS.findIndex(p => p.id === pref);
                        if (pIndex > -1) {
                            const p = PROVIDERS[pIndex];
                            const others = PROVIDERS.filter(x => x.id !== pref);
                            targetProviders = [p, ...others];
                            console.log(`[RateService] Priority updated to: ${pref.toUpperCase()}`);
                        }
                    }
                }
            }
        } catch(e) { console.warn("Failed to read provider pref", e.message); }
    }

    if (targetProviders.length === 0) {
        return { success: false, error: `Provider configuration invalid.` };
    }

    // --- FAILOVER LOOP ---
    for (const provider of targetProviders) {
        try {
            console.log(`[RateService] Attempting fetch from ${provider.name}...`);
            const rawText = await fetchInsecure(provider.url);
            
            let rate24k = 0;
            let rateSilver = 0;
            let matchDebug = `Source: ${provider.name} | `;
            let isJson = false;

            // --- STRATEGY A: JSON PARSING (For Batuk/Augmont) ---
            try {
                // Simple heuristic: starts with { or [
                if (rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
                    const json = JSON.parse(rawText);
                    isJson = true;
                    matchDebug += "Format: JSON | ";

                    // 1. SPECIFIC BATUK STRUCTURE (Nested Arrays)
                    // Expecting: { data: [ [ { gSell: "...", sSell: "..." } ] ] }
                    if (json.data && Array.isArray(json.data) && json.data[0] && Array.isArray(json.data[0])) {
                        const item = json.data[0][0]; // First item in nested array
                        
                        if (item) {
                            if (item.gSell) {
                                rate24k = parseFloat(item.gSell);
                                matchDebug += `Batuk Targeted gSell: ${rate24k} `;
                            }
                            if (item.sSell) {
                                rateSilver = parseFloat(item.sSell);
                                matchDebug += `Batuk Targeted sSell: ${rateSilver} `;
                            }
                        }
                    }

                    // 2. FALLBACK HEURISTIC (If specific structure not found or rate is 0)
                    if (rate24k === 0) {
                        // Gold Search (Prioritize "sell" rates if explicit, else general)
                        let gRaw = findJsonValue(json, /gold/i) || findJsonValue(json, /24k/i);
                        // Silver Search
                        let sRaw = findJsonValue(json, /silver/i);

                        if (gRaw) {
                            rate24k = parseFloat(gRaw);
                            matchDebug += `Heuristic Gold Found: ${rate24k} `;
                        }
                        if (sRaw) {
                            rateSilver = parseFloat(sRaw);
                            matchDebug += `Heuristic Silver Found: ${rateSilver} `;
                        }
                    }
                }
            } catch (e) {
                // Not JSON, ignore
            }

            // --- STRATEGY B: TEXT/VOTS PARSING (For Sagar) ---
            if (!isJson || rate24k === 0) {
                const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                
                // Helper
                const extractAfterHyphen = (line) => {
                    if (!line) return 0;
                    const parts = line.split('-');
                    if (parts.length < 2) return 0;
                    const pricePart = parts[1].trim();
                    const tokens = pricePart.split(/\s+/);
                    const price = parseFloat(tokens[0]);
                    return isNaN(price) ? 0 : price;
                };

                // 1. Extract Gold Rate (Scanning for GOLD + 99.9/999/995)
                const goldLine = lines.find(l => /GOLD.*(99\.9|995|999)/i.test(l) && !l.includes('3% GST'));
                
                if (goldLine) {
                    rate24k = extractAfterHyphen(goldLine);
                    matchDebug += `Gold Line (Text): ${goldLine} | Parsed: ${rate24k}`;
                }

                // 2. Extract Silver Rate
                const silverLine = lines.find(l => /SILVER/i.test(l) && !l.includes('3% GST'));
                if (silverLine) {
                    rateSilver = extractAfterHyphen(silverLine);
                    matchDebug += ` || Silver Line (Text): ${silverLine} | Parsed: ${rateSilver}`;
                }
            }

            // 3. Normalization (Handle 10g vs 1g and KG vs 1g)
            // Gold: If > 20,000, assume it's for 10g or oz, convert to 1g
            // Typical 1g rate ~7000. Typical 10g rate ~70000.
            if (rate24k > 20000) {
                rate24k = rate24k / 10; 
                matchDebug += " (Gold Normalized /10)";
            }

            // Silver: If > 10,000, assume KG, convert to 1g
            // Typical 1g rate ~90. Typical 1kg rate ~90000.
            if (rateSilver > 10000) {
                rateSilver = rateSilver / 1000;
                matchDebug += " (Silver Normalized /1000)";
            }

            // 4. Validation
            rate24k = Math.round(rate24k);
            rateSilver = Math.round(rateSilver || 90);

            if (rate24k > 1000) {
                // Success! We found a valid rate.
                successData = {
                    rate24k,
                    rateSilver,
                    matchDebug,
                    rawSnippet: rawText.substring(0, 500) // snippet
                };
                winningProvider = provider.name;
                break; // Exit loop, we have data
            } else {
                if (provider.id === 'batuk') console.warn(`[RateService] Batuk response parsed but invalid rate: ${rate24k} (Raw Text Len: ${rawText.length})`);
                // Don't throw immediately, let loop continue unless forced
                if (forcedProviderId) throw new Error(`Provider ${provider.name} returned invalid rate: ${rate24k}`);
            }

        } catch (e) {
            console.warn(`[RateService] ${provider.name} failed: ${e.message}`);
            lastError = e;
            // Continue to next provider...
        }
    }

    if (!successData) {
        console.error("[RateService] All providers failed.");
        return { success: false, error: lastError ? lastError.message : "All providers failed" };
    }

    // --- SAVE TO DB (If we got here, we have valid data) ---
    try {
        const { rate24k, rateSilver, matchDebug, rawSnippet } = successData;
        const rate22k = Math.round(rate24k * 0.916);
        const rate18k = Math.round(rate24k * 0.75);

        const pool = getPool();
        if (pool) {
            const connection = await pool.getConnection();
            
            await connection.query(
                'INSERT INTO gold_rates (rate24k, rate22k, rate18k, rateSilver) VALUES (?, ?, ?, ?)', 
                [rate24k, rate22k, rate18k, rateSilver]
            );
            
            // Update Core Settings Cache
            const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['core_settings']);
            if (rows.length > 0) {
                const config = JSON.parse(rows[0].config);
                config.currentGoldRate24K = rate24k;
                config.currentGoldRate22K = rate22k;
                config.currentGoldRate18K = rate18k;
                config.currentSilverRate = rateSilver;
                await connection.query("UPDATE integrations SET config = ? WHERE provider = ?", [JSON.stringify(config), 'core_settings']);
            }
            connection.release();
        }
        
        const payload = { 
            rate24k, rate22k, rate18k, rateSilver, 
            source: `${winningProvider} (Live)`,
            timestamp: new Date().toISOString(),
            rawSnippet,
            matchDebug
        };
        
        console.log(`[RateService] Success via ${winningProvider}: 1g 24K=₹${rate24k}`);
        
        if (io) {
            io.emit('rate_update', payload);
        }
        
        // Check for rate breaches
        await checkRateBreaches();

        return { success: true, ...payload };

    } catch (e) {
        console.error("[RateService] DB Save failed:", e.message);
        return { success: false, error: "Network Success but DB Save Failed: " + e.message };
    }
}

export async function checkRateBreaches(targetOrderId = null, forceTest = false) {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        
        // Fetch settings
        const [settingsRows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['core_settings']);
        const config = settingsRows.length > 0 ? JSON.parse(settingsRows[0].config) : {};
        const breachBufferMinutes = config.breachBufferMinutes || 30;
        const cooldownHours = config.cooldownHours || 24;
        
        // Fetch WhatsApp credentials
        const [whatsappRows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['whatsapp']);
        const whatsappConfig = whatsappRows.length > 0 ? JSON.parse(whatsappRows[0].config) : {};
        const { phoneId, token } = whatsappConfig;

        // Fetch orders with protection limit
        let query = "SELECT * FROM orders WHERE protectionLimit IS NOT NULL AND protectionLimit > 0";
        const params = [];
        if (targetOrderId && typeof targetOrderId === 'string') {
            query = "SELECT * FROM orders WHERE id = ?";
            params.push(targetOrderId);
        }
        const [orders] = await connection.query(query, params);

        if (forceTest && orders.length === 0) {
            throw new Error("Order not found. Note: Only orders with an active Rate Protection Limit can be tested for breaches.");
        }

        // Fetch current rate
        const [rateRows] = await connection.query("SELECT rate24k FROM gold_rates ORDER BY recorded_at DESC LIMIT 1");
        const currentRate24k = rateRows.length > 0 ? rateRows[0].rate24k : 0;

        for (const order of orders) {
            const isBreached = currentRate24k > order.protectionLimit;
            const now = Date.now();
            const lastNotifiedAt = order.lastNotifiedAt ? new Date(order.lastNotifiedAt).getTime() : 0;
            const cooldownMs = cooldownHours * 60 * 60 * 1000;

            // Check if any milestone is missed (overdue)
            const [milestones] = await connection.query("SELECT * FROM payment_schedules WHERE orderId = ? AND status = 'PENDING' AND dueDate < ?", [order.id, new Date()]);
            const hasMissedMilestone = milestones.length > 0;

            // Calculate variables for the template
            const orderData = JSON.parse(order.data);
            const customerName = orderData.customerName || "Customer";
            const customerPhone = order.customer_contact || orderData.customerContact || orderData.customerPhone;
            
            const bookedRate = orderData.paymentPlan?.protectionRateBooked || orderData.goldRateAtBooking || 0;
            const diff = currentRate24k - bookedRate;
            const surchargePerGram = diff > order.protectionLimit ? diff - order.protectionLimit : 0;
            const totalWeight = orderData.items?.reduce((sum, item) => sum + (item.netWeight || 0), 0) || 0;
            const taxRate = config.defaultTaxRate || 3;
            const estimatedImpact = surchargePerGram * totalWeight * (1 + (taxRate/100));
            const newEffectiveRate = bookedRate + surchargePerGram;

            const components = [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: customerName },
                        { type: "text", text: Math.round(estimatedImpact).toLocaleString() },
                        { type: "text", text: order.id },
                        { type: "text", text: newEffectiveRate.toString() },
                        { type: "text", text: orderData.shareToken || "" }
                    ]
                }
            ];

            if (forceTest || (isBreached && !order.isRateBreached)) {
                // Potential breach
                if (forceTest || now - lastNotifiedAt > cooldownMs) {
                    const templateName = hasMissedMilestone ? 'auragold_rate_adjustment_liability' : 'auragold_rate_adjustment_alert';
                    
                    try {
                        await sendWhatsAppMessage({
                            to: customerPhone,
                            templateName,
                            components,
                            customerName: customerName,
                            phoneId,
                            token
                        });
                        // Update order data
                        orderData.isRateBreached = true;
                        // Only require liability acceptance if they have missed a milestone
                        orderData.requiresLiabilityAcceptance = hasMissedMilestone;
                        
                        await connection.query("UPDATE orders SET data = ?, lastNotifiedAt = ? WHERE id = ?", [JSON.stringify(orderData), new Date(), order.id]);
                        if (io) io.emit('orders_sync');
                    } catch (err) {
                        console.error(`[RateService] Failed to send breach alert for order ${order.id}:`, err.message);
                        if (forceTest) throw err;
                    }
                }
            } else if (!isBreached && order.isRateBreached) {
                // Rate stabilized
                if (forceTest || now - lastNotifiedAt > cooldownMs) {
                    try {
                        await sendWhatsAppMessage({
                            to: customerPhone,
                            templateName: 'auragold_rate_stabilized',
                            components,
                            customerName: customerName,
                            phoneId,
                            token
                        });
                        // Update order data
                        orderData.isRateBreached = false;
                        orderData.requiresLiabilityAcceptance = false;
                        await connection.query("UPDATE orders SET data = ?, lastNotifiedAt = ? WHERE id = ?", [JSON.stringify(orderData), new Date(), order.id]);
                        if (io) io.emit('orders_sync');
                    } catch (err) {
                        console.error(`[RateService] Failed to send stabilized alert for order ${order.id}:`, err.message);
                        if (forceTest) throw err;
                    }
                }
            }
        }
        connection.release();
    } catch (e) {
        console.error("[RateService] checkRateBreaches error:", e);
        throw e; // Throw so the test route can catch and display the error
    }
}

export async function initRateService() {
    try {
        const pool = getPool();
        if (!pool) return setTimeout(initRateService, 5000); // Wait for DB

        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['core_settings']);
        connection.release();

        let interval = 60; // Default
        if (rows.length > 0) {
            const config = JSON.parse(rows[0].config);
            interval = config.goldRateFetchIntervalMinutes || 60;
        }

        startLoop(interval);
    } catch (e) {
        console.error("[RateService] Initialization error:", e.message);
    }
}

function startLoop(mins) {
    const safeMins = parseInt(mins) || 60;
    
    if (backgroundInterval) clearInterval(backgroundInterval);
    currentIntervalMins = safeMins;
    
    // Immediate first fetch
    fetchAndSaveRate();

    backgroundInterval = setInterval(() => {
        fetchAndSaveRate();
    }, safeMins * 60 * 1000);
    
    console.log(`[RateService] Background task started. Fetch interval: ${safeMins} minutes.`);
}

export function refreshInterval(newMins) {
    const mins = parseInt(newMins);
    if (isNaN(mins) || mins < 1) return;
    if (mins === currentIntervalMins) return;
    console.log(`[RateService] Refreshing interval to ${mins} mins`);
    startLoop(mins);
}
