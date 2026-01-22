
import express from 'express';
import { getPool, ensureDb } from './db.js';
import { fetchAndSaveRate } from './rateService.js';

const router = express.Router();

router.get('/gold-rate', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();

        // 1. Get Configuration (to know what "Stale" means)
        const [configRows] = await connection.query("SELECT config FROM integrations WHERE provider = 'core_settings'");
        let intervalMins = 60; // Default to 60 minutes
        if (configRows.length > 0) {
            try {
                intervalMins = JSON.parse(configRows[0].config).goldRateFetchIntervalMinutes || 60;
            } catch (e) {}
        }

        // 2. Check Last Recorded Rate
        const [rows] = await connection.query('SELECT rate24k, rate22k, rate18k, rateSilver, recorded_at FROM gold_rates ORDER BY recorded_at DESC LIMIT 1');
        connection.release(); // Release early to prevent blocking

        let shouldUseCache = false;
        let cachedData = null;

        if (rows.length > 0) {
            const lastRecord = rows[0];
            const lastTime = new Date(lastRecord.recorded_at).getTime();
            const now = Date.now();
            const diffMins = (now - lastTime) / (1000 * 60);

            // If data is fresh (younger than the interval), use it.
            if (diffMins < intervalMins) {
                shouldUseCache = true;
                cachedData = lastRecord;
            } else {
                console.log(`[SmartFetch] Data is stale (${Math.round(diffMins)} mins old). Fetching fresh rates...`);
            }
        }

        // 3. Logic Branch
        if (!shouldUseCache) {
            // Data is Stale or Missing -> Fetch New
            const result = await fetchAndSaveRate();
            
            if (result.success) {
                // Return FRESH data
                const rate24k = result.rate24k;
                const rate22k = Math.round(rate24k * 0.916);
                const rate18k = Math.round(rate24k * 0.75);
                const rateSilver = result.rateSilver || 90;
                
                return res.json({ 
                    success: true, 
                    k24: rate24k, 
                    k22: rate22k, 
                    k18: rate18k, 
                    silver: rateSilver,
                    source: 'Sagar Jewellers (Live Refresh)',
                    raw: { snippet: result.rawSnippet, debug: result.matchDebug }
                });
            } else {
                // Fetch failed, force fallback to cache if available
                if (rows.length > 0) {
                    shouldUseCache = true;
                    cachedData = rows[0];
                    // Append error info to response so user knows it's cached due to error
                    cachedData.error = result.error; 
                } else {
                    throw new Error(result.error || "No rates found and fetch failed");
                }
            }
        }

        // 4. Return Cached Data (if fresh or fallback)
        if (shouldUseCache && cachedData) {
            res.json({
                success: true,
                k24: parseFloat(cachedData.rate24k),
                k22: parseFloat(cachedData.rate22k),
                k18: parseFloat(cachedData.rate18k),
                silver: parseFloat(cachedData.rateSilver || 90),
                source: 'Local Database (Cached)',
                error: cachedData.error,
                raw: { debug: 'SmartFetch: Data within interval range' }
            });
        }

    } catch (e) { 
        res.status(500).json({ success: false, error: e.message }); 
    }
});

router.get('/rates/history', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        // Retrieve last 5000 points for granular charting (frontend will filter)
        const [rows] = await connection.query('SELECT rate24k, rate22k, rate18k, rateSilver, recorded_at FROM gold_rates ORDER BY recorded_at DESC LIMIT 5000');
        connection.release();
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// CRON ENDPOINT: Kept for optional usage, but not required with SmartFetch
router.get('/cron/update', async (req, res) => {
    console.log("[Cron] External rate update triggered");
    try {
        const result = await fetchAndSaveRate();
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
