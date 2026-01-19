
import mysql from 'mysql2/promise';

let pool = null;

export async function initDb() {
    try {
        if (pool) await pool.end();
        const dbConfig = {
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: 3306,
            waitForConnections: true,
            connectionLimit: 10,
            connectTimeout: 20000,
            enableKeepAlive: true
        };
        pool = mysql.createPool(dbConfig);
        const connection = await pool.getConnection();
        const tables = [
            `CREATE TABLE IF NOT EXISTS gold_rates (id INT AUTO_INCREMENT PRIMARY KEY, rate24k DECIMAL(10, 2), rate22k DECIMAL(10, 2), rate18k DECIMAL(10, 2), recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS integrations (provider VARCHAR(50) PRIMARY KEY, config JSON, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS app_config (setting_key VARCHAR(50) PRIMARY KEY, setting_value VARCHAR(255))`,
            `CREATE TABLE IF NOT EXISTS customers (id VARCHAR(100) PRIMARY KEY, contact VARCHAR(50), name VARCHAR(255), data LONGTEXT, updated_at BIGINT)`,
            `CREATE TABLE IF NOT EXISTS orders (id VARCHAR(100) PRIMARY KEY, customer_contact VARCHAR(50), status VARCHAR(50), created_at DATETIME, data LONGTEXT, updated_at BIGINT)`,
            `CREATE TABLE IF NOT EXISTS whatsapp_logs (id VARCHAR(100) PRIMARY KEY, phone VARCHAR(50), direction VARCHAR(20), timestamp DATETIME, data LONGTEXT)`,
            `CREATE TABLE IF NOT EXISTS templates (id VARCHAR(100) PRIMARY KEY, name VARCHAR(255), category VARCHAR(50), data LONGTEXT)`,
            `CREATE TABLE IF NOT EXISTS plan_templates (id VARCHAR(100) PRIMARY KEY, name VARCHAR(255), data LONGTEXT)`,
            `CREATE TABLE IF NOT EXISTS catalog (id VARCHAR(100) PRIMARY KEY, category VARCHAR(100), data LONGTEXT)`
        ];
        for (const sql of tables) await connection.query(sql);

        // SEED DEFAULT SETTINGS IF MISSING
        const [rows] = await connection.query("SELECT * FROM integrations WHERE provider = 'core_settings'");
        if (rows.length === 0) {
            const defaults = {
                currentGoldRate24K: 7500, currentGoldRate22K: 6870, currentGoldRate18K: 5625,
                purityFactor22K: 0.916, purityFactor18K: 0.75,
                defaultTaxRate: 3, goldRateProtectionMax: 500, gracePeriodHours: 24, followUpIntervalDays: 3
            };
            await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?)", ['core_settings', JSON.stringify(defaults)]);
        }

        connection.release();
        return { success: true };
    } catch (err) {
        console.error("[DB INIT ERROR]", err.message);
        pool = null; 
        return { success: false, error: err.message };
    }
}

export const getPool = () => pool;

export const ensureDb = async (req, res, next) => {
    if (!pool) {
        const result = await initDb();
        if (!result.success) return res.status(503).json({ error: "Database Unavailable" });
    }
    next();
};

export const normalizePhone = (p) => p ? p.replace(/\D/g, '').slice(-10) : '';
