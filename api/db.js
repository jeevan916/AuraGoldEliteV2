
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

let pool = null;
export let isMock = false;
const mockData = {
    gold_rates: [],
    app_users: [{ id: 1, username: 'admin', password_hash: '$2a$10$8K1p/a06Ewe7SclT.8mS8uXvL0.X.X.X.X.X.X.X.X.X.X.X.X.X.X.', role: 'ADMIN' }], // Placeholder, will be fixed in auth
    integrations: [
        { 
            provider: 'core_settings', 
            config: JSON.stringify({
                preferredRateProvider: 'auto',
                goldRateFetchIntervalMinutes: 60,
                currentGoldRate24K: 7500,
                currentGoldRate22K: 6870,
                currentGoldRate18K: 5625,
                currentSilverRate: 90
            }) 
        }
    ],
    system_activities: [],
    system_errors: []
};

export async function initDb() {
    try {
        if (pool) await pool.end();
        
        const host = process.env.DB_HOST;
        // Only fallback to mock if host is missing, OR if we are inside AI Studio and trying to use localhost
        if (!host || (process.env.APPLET_ID && (host === '127.0.0.1' || host === 'localhost'))) {
            console.warn("[DB] No external DB_HOST provided. Falling back to Mock Database.");
            isMock = true;
            return { success: true, mock: true };
        }

        const dbConfig = {
            host: host,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: 3306,
            waitForConnections: true,
            connectionLimit: 5, // Reduced to prevent EMFILE
            connectTimeout: 10000,
            enableKeepAlive: true
        };
        pool = mysql.createPool(dbConfig);
        const connection = await pool.getConnection();
        isMock = false;
        console.log(`[DB] Successfully connected to MySQL at ${host}`);
        
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
            `CREATE TABLE IF NOT EXISTS system_activities (
                id VARCHAR(100) PRIMARY KEY,
                action_type VARCHAR(50),
                details TEXT,
                metadata JSON,
                ip_address VARCHAR(45),
                geo_location VARCHAR(255),
                device_info VARCHAR(255),
                timestamp DATETIME
            )`,
            // NEW: Users Table for Staff/Admin Login
            `CREATE TABLE IF NOT EXISTS app_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];
        for (const sql of tables) await connection.query(sql);
        
        try {
            await connection.query("ALTER TABLE gold_rates ADD COLUMN rateSilver DECIMAL(10, 2) DEFAULT 0");
        } catch (e) { }

        // --- SEED DEFAULT ADMIN ---
        const [users] = await connection.query("SELECT * FROM app_users WHERE username = 'admin'");
        if (users.length === 0) {
            console.log("[DB] Seeding default admin user...");
            const hash = await bcrypt.hash('admin123', 10);
            await connection.query(
                "INSERT INTO app_users (username, password_hash, role) VALUES (?, ?, ?)",
                ['admin', hash, 'ADMIN']
            );
        }

        connection.release();
        return { success: true };
    } catch (err) {
        console.error("[DB] Connection Error:", err.message);
        pool = null; 
        return { success: false, error: err.message };
    }
}

export const getPool = () => {
    if (isMock) {
        return {
            getConnection: async () => ({
                query: async (sql, params) => {
                    const lowerSql = sql.toLowerCase();
                    
                    if (lowerSql.includes('select * from app_users where username = ?')) {
                        const user = mockData.app_users.find(u => u.username === params[0]);
                        return [user ? [user] : []];
                    }
                    if (lowerSql.includes('select config from integrations where provider = ?')) {
                        const row = mockData.integrations.find(i => i.provider === params[0]);
                        return [row ? [row] : []];
                    }
                    if (lowerSql.includes('insert into system_activities')) {
                        mockData.system_activities.push(params);
                        return [{ insertId: Date.now() }];
                    }
                    if (lowerSql.includes('select * from system_activities')) {
                        return [mockData.system_activities];
                    }
                    if (lowerSql.includes('select * from system_errors')) {
                        return [mockData.system_errors];
                    }
                    if (lowerSql.includes('select * from gold_rates')) {
                        return [mockData.gold_rates];
                    }
                    if (lowerSql.includes('insert into gold_rates')) {
                        mockData.gold_rates.push({ id: Date.now(), rate24k: params[0], rate22k: params[1], rate18k: params[2], rateSilver: params[3] });
                        return [{ insertId: Date.now() }];
                    }
                    if (lowerSql.includes('update integrations set config = ? where provider = ?')) {
                        const index = mockData.integrations.findIndex(i => i.provider === params[1]);
                        if (index > -1) mockData.integrations[index].config = params[0];
                        return [{ affectedRows: 1 }];
                    }
                    return [[]];
                },
                release: () => {}
            }),
            query: async (sql, params) => {
                const conn = await getPool().getConnection();
                const res = await conn.query(sql, params);
                conn.release();
                return res;
            }
        };
    }
    return pool;
};

export const ensureDb = async (req, res, next) => {
    if (!pool && !isMock) {
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
    
    return clean;
};

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
