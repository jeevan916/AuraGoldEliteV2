
import express from 'express';
import { getPool, ensureDb } from './db.js';

const router = express.Router();

router.get('/gold-rate', ensureDb, async (req, res) => {
    try {
        let rate24k = 0;
        let source = 'Local DB';
        try {
            const externalRes = await fetch('https://uat.batuk.in/augmont/gold');
            if (externalRes.ok) {
                const extData = await externalRes.json();
                if (!extData.error && extData.data && extData.data[0] && extData.data[0][0]) {
                    const gSell = parseFloat(extData.data[0][0].gSell);
                    rate24k = Math.round(gSell / 2);
                    source = 'Augmont Live (Augmont/Batuk)';
                }
            }
        } catch (e) { console.warn("Gold API failed, fallback active"); }

        const pool = getPool();
        const connection = await pool.getConnection();
        if (rate24k === 0) {
            const [rows] = await connection.query('SELECT rate24k FROM gold_rates ORDER BY recorded_at DESC LIMIT 1');
            rate24k = rows.length > 0 ? parseFloat(rows[0].rate24k) : 7500;
        }
        const rate22k = Math.round(rate24k * 0.916);
        const rate18k = Math.round(rate24k * 0.75);
        await connection.query('INSERT INTO gold_rates (rate24k, rate22k, rate18k) VALUES (?, ?, ?)', [rate24k, rate22k, rate18k]);
        connection.release();
        res.json({ success: true, k24: rate24k, k22: rate22k, k18: rate18k, source });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

export default router;
