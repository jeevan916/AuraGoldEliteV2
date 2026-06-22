import { config } from 'dotenv';
config();
import { initDb, getPool } from './api/db.js';

async function main() {
    await initDb();
    const pool = getPool();
    const conn = await pool.getConnection();
    const [rows] = await conn.query("SELECT * FROM webhook_logs ORDER BY timestamp DESC LIMIT 5");
    console.log(JSON.stringify(rows, null, 2));
    conn.release();
    process.exit(0);
}

main().catch(console.error);
