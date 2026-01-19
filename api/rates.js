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
                    const gSell = parseFloat(extData.data[0][0].gSell);
                    if (gSell > 0) {
                        rate24k = Math.round(gSell);
                        source = 'Augmont Live';
                    }
                }
            }
        } catch (e) { 
            console.warn("Gold API failed, fallback to DB:", e.message); 
        }

        const pool = getPool();
        const connection = await pool.getConnection();
        
        if (rate24k === 0) {
            const [rows] = await connection.query('SELECT rate24k FROM gold_rates ORDER BY recorded_at DESC LIMIT 1');
            rate24k = rows.length > 0 ? parseFloat(rows[0].rate24k) : 7500;
        }

        // Fetch Business Rules (Purity Factors)
        const [configRows] = await connection.query("SELECT config FROM integrations WHERE provider = 'core_settings'");
        const config = configRows.length > 0 ? JSON.parse(configRows[0].config) : { purityFactor22K: 0.916, purityFactor18K: 0.750 };

        const rate22k = Math.round(rate24k * (config.purityFactor22K || 0.916));
        const rate18k = Math.round(rate24k * (config.purityFactor18K || 0.750));
        
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
        res.status(500).json({ success: false, error: e.message }); 
    }
});

export default router;