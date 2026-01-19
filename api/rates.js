
import express from 'express';
import { getPool, ensureDb } from './db.js';

const router = express.Router();

router.get('/gold-rate', ensureDb, async (req, res) => {
    let rawResponse = null;
    try {
        let rate24k = 0;
        let source = 'Local DB';
        
        try {
            const externalRes = await fetch('https://uat.batuk.in/augmont/gold', {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (externalRes.ok) {
                const extData = await externalRes.json();
                rawResponse = extData;
                if (!extData.error && extData.data && extData.data[0] && extData.data[0][0]) {
                    const priceData = extData.data[0][0];
                    const gSell = parseFloat(priceData.gSell);
                    if (gSell > 0) {
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
        
        // 1. Get Factors from Settings
        const [intRows] = await connection.query("SELECT config FROM integrations WHERE provider = 'core_settings'");
        const settings = intRows.length > 0 ? JSON.parse(intRows[0].config) : { purityFactor22K: 0.916, purityFactor18K: 0.75 };
        const f22k = settings.purityFactor22K || 0.916;
        const f18k = settings.purityFactor18K || 0.75;

        // 2. Fetch fallback rate if live failed
        if (rate24k === 0) {
            const [rows] = await connection.query('SELECT rate24k FROM gold_rates ORDER BY recorded_at DESC LIMIT 1');
            rate24k = rows.length > 0 ? parseFloat(rows[0].rate24k) : 7500;
        }

        // 3. Dynamic Calculation based on Wiring
        const rate22k = Math.round(rate24k * f22k);
        const rate18k = Math.round(rate24k * f18k);
        
        await connection.query('INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)', [rate24k, rate22k, rate18k]);
        connection.release();

        res.json({ 
            success: true, 
            k24: rate24k, 
            k22: rate22k, 
            k18: rate18k, 
            factors: { k22: f22k, k18: f18k },
            source,
            raw: rawResponse 
        });
    } catch (e) { 
        res.status(500).json({ success: false, error: e.message }); 
    }
});

export default router;
