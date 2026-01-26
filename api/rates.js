
import express from 'express';
import { getPool, ensureDb } from './db.js';
import { fetchAndSaveRate } from './rateService.js';

const router = express.Router();

router.get('/gold-rate', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();

        // 1. Get Configuration (for interval and fallback)
        const [configRows] = await connection.query("SELECT config FROM integrations WHERE provider = 'core_settings'");
        let intervalMins = 60; 
        let manualConfig = null;
        
        if (configRows.length > 0) {
            try {
                manualConfig = JSON.parse(configRows[0].config);
                intervalMins = manualConfig.goldRateFetchIntervalMinutes || 60;
            } catch (e) {}
        }

        // 2. Check Last Recorded Rate (DB Cache)
        const [rows] = await connection.query('SELECT rate24k, rate22k, rate18k, rateSilver, recorded_at FROM gold_rates ORDER BY recorded_at DESC LIMIT 1');
        
        // Helper to format response
        const sendResponse = (data, source, error = null) => {
            res.json({
                success: true,
                k24: parseFloat(data.rate24k || data.currentGoldRate24K || 0),
                k22: parseFloat(data.rate22k || data.currentGoldRate22K || 0),
                k18: parseFloat(data.rate18k || data.currentGoldRate18K || 0),
                silver: parseFloat(data.rateSilver || data.currentSilverRate || 0),
                source,
                error,
                raw: data.raw || {}
            });
        };

        // 3. Determine if we need to fetch
        let shouldUseCache = false;
        let cachedRecord = null;

        if (rows.length > 0) {
            cachedRecord = rows[0];
            const lastTime = new Date(cachedRecord.recorded_at).getTime();
            const diffMins = (Date.now() - lastTime) / (1000 * 60);
            
            if (diffMins < intervalMins) {
                shouldUseCache = true;
            }
        }

        if (shouldUseCache) {
            connection.release();
            return sendResponse(cachedRecord, 'Local Database (Cached)');
        }

        // 4. Attempt Live Fetch
        // Release connection before long-running network call to avoid blocking pool
        connection.release(); 
        
        const result = await fetchAndSaveRate();

        if (result.success) {
            // Use the source returned by the multi-provider service
            return sendResponse(result, result.source || 'Live Feed');
        }

        // 5. Fallback Strategy
        // Level 1: Stale DB Data
        if (rows.length > 0) {
            return sendResponse(rows[0], 'Local Database (Stale Fallback)', result.error);
        }

        // Level 2: Manual Settings (if DB is empty, e.g., first run or cleared DB)
        if (manualConfig && manualConfig.currentGoldRate24K) {
            return sendResponse(manualConfig, 'Manual Settings (Emergency Fallback)', result.error);
        }

        // Level 3: Hard Fail
        throw new Error(result.error || "Rates unavailable: API failed, DB empty, Settings missing.");

    } catch (e) { 
        res.status(503).json({ success: false, error: e.message }); 
    }
});

// FORCE FETCH ENDPOINT (Manual Source Switch)
router.post('/rates/force-update', ensureDb, async (req, res) => {
    try {
        const { providerId } = req.body;
        // Calls service with explicit provider to bypass priority order
        const result = await fetchAndSaveRate(providerId);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.get('/rates/history', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT rate24k, rate22k, rate18k, rateSilver, recorded_at FROM gold_rates ORDER BY recorded_at DESC LIMIT 5000');
        connection.release();
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// CRON ENDPOINT
router.get('/cron/update', async (req, res) => {
    try {
        const result = await fetchAndSaveRate();
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
