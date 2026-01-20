
import { getPool } from './db.js';

let backgroundInterval = null;
let currentIntervalMins = null;

/**
 * Fetches gold rate from external API and saves to database.
 */
export async function fetchAndSaveRate() {
    console.log(`[RateService] Executing scheduled fetch: ${new Date().toISOString()}`);
    try {
        const externalRes = await fetch('https://uat.batuk.in/augmont/gold', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (!externalRes.ok) throw new Error("External API unreachable");
        
        const extData = await externalRes.json();
        if (extData.error || !extData.data || !extData.data[0] || !extData.data[0][0]) {
            throw new Error("Invalid API response format");
        }

        const priceData = extData.data[0][0];
        const rate24k = Math.round(parseFloat(priceData.gSell));
        
        // Robust Silver Logic: 
        // Some APIs return per KG (e.g. 92000), some per Gram (e.g. 92).
        // Standardizing to per gram for Silver 999.
        let rateSilver = 0;
        if (priceData.sSell) {
            const rawSilver = parseFloat(priceData.sSell);
            rateSilver = rawSilver > 1000 ? Math.round(rawSilver / 1000) : Math.round(rawSilver);
        } else {
            rateSilver = 90; // Hard fallback
        }

        if (!rate24k || rate24k <= 0) throw new Error("Invalid rate value received");

        const rate22k = Math.round(rate24k * 0.916);
        const rate18k = Math.round(rate24k * 0.75);

        const pool = getPool();
        if (!pool) return; 
        
        const connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO gold_rates (rate24k, rate22k, rate18k, rateSilver) VALUES (?, ?, ?, ?)', 
            [rate24k, rate22k, rate18k, rateSilver]
        );
        
        // Also update core_settings so the frontend gets the latest "official" rate on bootstrap
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
        if (!pool) return setTimeout(initRateService, 5000);

        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = 'core_settings'");
        connection.release();

        let interval = 60;
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
    
    fetchAndSaveRate();
    backgroundInterval = setInterval(() => {
        fetchAndSaveRate();
    }, mins * 60 * 1000);
    
    console.log(`[RateService] Background task started. Fetch interval: ${mins} minutes.`);
}

export function refreshInterval(newMins) {
    if (newMins === currentIntervalMins) return;
    console.log(`[RateService] Refreshing interval to ${newMins} mins`);
    startLoop(newMins);
}
