
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
            `CREATE TABLE IF NOT EXISTS gold_rates (id INT AUTO_INCREMENT PRIMARY KEY, rate24k DECIMAL(10, 2), rate22k DECIMAL(10, 2), rate18k DECIMAL(10, 2), rateSilver DECIMAL(10, 2) DEFAULT 0, recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS integrations (provider VARCHAR(50) PRIMARY KEY, config JSON, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS app_config (setting_key VARCHAR(50) PRIMARY KEY, setting_value VARCHAR(255))`,
            `CREATE TABLE IF NOT EXISTS customers (id VARCHAR(100) PRIMARY KEY, contact VARCHAR(50), name VARCHAR(255), data LONGTEXT, updated_at BIGINT)`,
            `CREATE TABLE IF NOT EXISTS orders (id VARCHAR(100) PRIMARY KEY, customer_contact VARCHAR(50), status VARCHAR(50), created_at DATETIME, data LONGTEXT, updated_at BIGINT)`,
            `CREATE TABLE IF NOT EXISTS whatsapp_logs (id VARCHAR(100) PRIMARY KEY, phone VARCHAR(50), direction VARCHAR(20), timestamp DATETIME, data LONGTEXT)`,
            `CREATE TABLE IF NOT EXISTS templates (id VARCHAR(100) PRIMARY KEY, name VARCHAR(255), category VARCHAR(50), data LONGTEXT)`,
            `CREATE TABLE IF NOT EXISTS plan_templates (id VARCHAR(100) PRIMARY KEY, name VARCHAR(255), data LONGTEXT)`,
            `CREATE TABLE IF NOT EXISTS catalog (id VARCHAR(100) PRIMARY KEY, category VARCHAR(100), data LONGTEXT)`,
            `CREATE TABLE IF NOT EXISTS system_errors (
                id VARCHAR(100) PRIMARY KEY, 
                source VARCHAR(100), 
                message TEXT, 
                stack TEXT, 
                severity VARCHAR(20), 
                timestamp DATETIME, 
                context JSON
            )`,
            // NEW: Activity Audit Table
            `CREATE TABLE IF NOT EXISTS system_activities (
                id VARCHAR(100) PRIMARY KEY,
                action_type VARCHAR(50),
                details TEXT,
                metadata JSON,
                ip_address VARCHAR(45),
                geo_location VARCHAR(255),
                device_info VARCHAR(255),
                timestamp DATETIME
            )`
        ];
        for (const sql of tables) await connection.query(sql);
        
        try {
            await connection.query("ALTER TABLE gold_rates ADD COLUMN rateSilver DECIMAL(10, 2) DEFAULT 0");
        } catch (e) { }

        connection.release();
        return { success: true };
    } catch (err) {
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

export const normalizePhone = (p) => {
    if (!p) return '';
    // Strip all non-numeric characters
    let clean = p.replace(/\D/g, '');
    
    // Logic for India (+91)
    // 10 digits -> Add 91
    if (clean.length === 10) return '91' + clean;
    // 11 digits starting with 0 -> Replace 0 with 91
    if (clean.length === 11 && clean.startsWith('0')) return '91' + clean.substring(1);
    // 12 digits starting with 91 -> Keep as is
    if (clean.length === 12 && clean.startsWith('91')) return clean;
    
    // For other cases (e.g. international), just return the cleaned numbers
    // This prevents the previous slice(-12) bug which could corrupt longer international numbers
    return clean;
};

// --- NEW SERVER-SIDE LOGGING HELPER ---
export const logDbActivity = async (actionType, details, metadata, req) => {
    if (!pool) return;
    try {
        const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim() : 'System';
        const userAgent = req ? req.get('User-Agent') : 'Internal Process';
        
        // Resolve Geo Location (Async, don't block)
        let location = 'Unknown';
        if (ip && ip !== '::1' && ip !== '127.0.0.1' && !ip.startsWith('192.168')) {
            try {
                const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`);
                const geoData = await geoRes.json();
                if (geoData.status === 'success') {
                    location = `${geoData.city}, ${geoData.regionName} (${geoData.isp})`;
                }
            } catch (e) {}
        } else {
            location = 'Local Network';
        }

        const enrichedMeta = {
            ...metadata,
            referer: req ? req.get('Referer') : undefined,
            platform: userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
        };

        const connection = await pool.getConnection();
        await connection.query(
            `INSERT INTO system_activities (id, action_type, details, metadata, ip_address, geo_location, device_info, timestamp) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                actionType,
                details,
                JSON.stringify(enrichedMeta),
                ip,
                location,
                userAgent.substring(0, 250), // Truncate to fit
                new Date()
            ]
        );
        connection.release();
    } catch (e) {
        console.error("Failed to log activity:", e.message);
    }
};
