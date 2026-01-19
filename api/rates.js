
import express from 'express';
import { getPool, ensureDb } from './db.js';

const router = express.Router();

router.get('/gold-rate', ensureDb, async (req, res) => {
    let rawResponse = null;
    try {
        let rate24k = 0;
        let source = 'Local DB';
        
        try {
            // Augmont/Batuk API Source
            const externalRes = await fetch('https://uat.batuk.in/augmont/gold', {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (externalRes.ok) {
                const extData = await externalRes.json();
                rawResponse = extData; // Store for diagnostics
                
                // Augmont structure check: data[0][0].gSell
                if (!extData.error && extData.data && extData.data[0] && extData.data[0][0]) {
                    const priceData = extData.data[0][0];
                    // gSell is usually the price per gram (approx 7000-8000 INR currently)
                    const gSell = parseFloat(priceData.gSell);
                    
                    if (gSell > 0) {
                        // REMOVED: Math.round(gSell / 2) - This was causing inaccuracies
                        rate24k = Math.round(gSell);
                        source = 'Augmont Live';
                    }
                }
            }
        } catch (e) { 
            console.warn("Gold API fetch failed, falling back to DB:", e.message); 
        }

        const pool = getPool();
        const connection = await pool.getConnection();
        
        // If external API failed or returned 0, use last known good rate from DB
        if (rate24k === 0) {
            const [rows] = await connection.query('SELECT rate24k FROM gold_rates ORDER BY recorded_at DESC LIMIT 1');
            rate24k = rows.length > 0 ? parseFloat(rows[0].rate24k) : 7500;
        }

        // Standard conversion logic
        const rate22k = Math.round(rate24k * 0.916);
        const rate18k = Math.round(rate24k * 0.75);
        
        // Record history
        await connection.query('INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)', [rate24k, rate22k, rate18k]);
        connection.release();

        res.json({ 
            success: true, 
            k24: rate24k, 
            k22: rate22k, 
            k18: rate18k, 
            source,
            raw: rawResponse 
        });
    } catch (e) { 
        res.status(500).json({ success: false, error: e.message, raw: rawResponse }); 
    }
});

export default router;
