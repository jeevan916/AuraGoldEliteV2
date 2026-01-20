
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
        if (!rate24k || rate24k <= 0) throw new Error("Invalid rate value received");

        const rate22k = Math.round(rate24k * 0.916);
        const rate18k = Math.round(rate24k * 0.75);

        const pool = getPool();
        if (!pool) return; // DB not ready yet
        
        const connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)', 
            [rate24k, rate22k, rate18k]
        );
        
        // Also update core_settings to reflect the latest "cached" rate for UI
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = 'core_settings'");
        if (rows.length > 0) {
            const config = JSON.parse(rows[0].config);
            config.currentGoldRate24K = rate24k;
            config.currentGoldRate22K = rate22k;
            config.currentGoldRate18K = rate18k;
            await connection.query("UPDATE integrations SET config = ? WHERE provider = 'core_settings'", [JSON.stringify(config)]);
        }

        connection.release();
        console.log(`[RateService] Rate successfully saved: 24K=₹${rate24k}`);
        return { success: true, rate24k };
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
