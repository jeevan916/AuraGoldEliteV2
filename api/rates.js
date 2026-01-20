
import express from 'express';
import { getPool, ensureDb } from './db.js';
import { fetchAndSaveRate } from './rateService.js';

const router = express.Router();

router.get('/gold-rate', ensureDb, async (req, res) => {
    try {
        // Trigger a fresh fetch and save
        const result = await fetchAndSaveRate();
        
        if (result.success) {
            const rate24k = result.rate24k;
            const rate22k = Math.round(rate24k * 0.916);
            const rate18k = Math.round(rate24k * 0.75);
            
            res.json({ 
                success: true, 
                k24: rate24k, 
                k22: rate22k, 
                k18: rate18k, 
                source: 'Augmont Live (Manual Trigger)'
            });
        } else {
            // Fallback to latest from DB if manual fetch failed
            const pool = getPool();
            const [rows] = await pool.query('SELECT rate24k, rate22k, rate18k FROM gold_rates ORDER BY recorded_at DESC LIMIT 1');
            
            if (rows.length > 0) {
                res.json({
                    success: true,
                    k24: parseFloat(rows[0].rate24k),
                    k22: parseFloat(rows[0].rate22k),
                    k18: parseFloat(rows[0].rate18k),
                    source: 'Local Cache (API Error Fallback)'
                });
            } else {
                throw new Error(result.error || "No rates found");
            }
        }
    } catch (e) { 
        res.status(500).json({ success: false, error: e.message }); 
    }
});

export default router;
