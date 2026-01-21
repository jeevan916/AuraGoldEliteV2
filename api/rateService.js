
import { getPool } from './db.js';

let backgroundInterval = null;
let currentIntervalMins = null;

/**
 * Fetches gold rate from external API and saves to database.
 * Source: Sagar Jewellers (VOTS Broadcast)
 */
export async function fetchAndSaveRate() {
    console.log(`[RateService] Executing scheduled fetch: ${new Date().toISOString()}`);
    try {
        const timestamp = Date.now();
        const apiUrl = `https://bcast.sagarjewellers.co.in:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/sagar?_=${timestamp}`;
        
        // Fetch with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const externalRes = await fetch(apiUrl, {
            method: 'GET',
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Node.js)',
                'Accept': 'text/xml, application/xml, text/plain' 
            },
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!externalRes.ok) throw new Error(`External API Error: ${externalRes.status}`);
        
        const xmlText = await externalRes.text();
        
        // --- PARSING LOGIC (Regex) ---
        // Handles standard VOTS XML format: <Symbol>GOLD 995</Symbol>...<Ask>75000</Ask>
        const extractRate = (symbolPattern) => {
            const regex = new RegExp(`(?:<Symbol>|<Product>)\\s*(${symbolPattern})\\s*(?:<\\/Symbol>|<\\/Product>)[\\s\\S]*?(?:<Ask>|<Sell>)\\s*([0-9.]+)\\s*(?:<\\/Ask>|<\\/Sell>)`, 'i');
            const match = xmlText.match(regex);
            return match ? parseFloat(match[2]) : 0;
        };

        // 1. Gold Rate (Try GOLD 999, then 995, then generic)
        let rate24k = extractRate('GOLD 999');
        if (!rate24k) rate24k = extractRate('GOLD 995');
        if (!rate24k) rate24k = extractRate('GOLD');

        // 2. Silver Rate (Try SILVER 999, then generic)
        let rateSilver = extractRate('SILVER 999');
        if (!rateSilver) rateSilver = extractRate('SILVER');

        // 3. Normalization
        // Gold usually quoted per 10g
        if (rate24k > 10000) rate24k = rate24k / 10;
        
        // Silver usually quoted per 1kg
        if (rateSilver > 1000) rateSilver = rateSilver / 1000;

        if (!rate24k || rate24k <= 0) {
            // Log snippet for debug if needed
            if (xmlText.length < 500) console.warn("Invalid XML Response:", xmlText);
            throw new Error("Parsed gold rate is invalid or zero");
        }

        rate24k = Math.round(rate24k);
        rateSilver = Math.round(rateSilver || 90); // Fallback to 90 if missing

        const rate22k = Math.round(rate24k * 0.916);
        const rate18k = Math.round(rate24k * 0.75);

        const pool = getPool();
        if (!pool) return { success: false, error: "Database not ready" };
        
        const connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO gold_rates (rate24k, rate22k, rate18k, rateSilver) VALUES (?, ?, ?, ?)', 
            [rate24k, rate22k, rate18k, rateSilver]
        );
        
        // Update Core Settings Cache
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = 'core_settings'");
        if (rows.length > 0) {
            const config = JSON.parse(rows[0].config);
            config.currentGoldRate24K = rate24k;
            config.currentGoldRate22K = rate22k;
            config.currentGoldRate18K = rate18k;
            config.currentSilverRate = rateSilver;
            await connection.query("UPDATE integrations SET config = ? WHERE provider = 'core_settings'", [JSON.stringify(config)]);
        }

        connection.release();
        console.log(`[RateService] Rates updated (Sagar): 24K=₹${rate24k}, Silver=₹${rateSilver}`);
        return { success: true, rate24k, rateSilver };
    } catch (e) {
        console.error("[RateService] Automatic fetch failed:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Initializes the background fetching loop.
 */
export async function initRateService() {
    try {
        const pool = getPool();
        if (!pool) return setTimeout(initRateService, 5000); // Wait for DB

        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = 'core_settings'");
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
    if (backgroundInterval) clearInterval(backgroundInterval);
    currentIntervalMins = mins;
    
    // Immediate first fetch
    fetchAndSaveRate();

    backgroundInterval = setInterval(() => {
        fetchAndSaveRate();
    }, mins * 60 * 1000);
    
    console.log(`[RateService] Background task started. Fetch interval: ${mins} minutes.`);
}

/**
 * Updates the fetching interval if changed in settings.
 */
export function refreshInterval(newMins) {
    if (newMins === currentIntervalMins) return;
    console.log(`[RateService] Refreshing interval to ${newMins} mins`);
    startLoop(newMins);
}
