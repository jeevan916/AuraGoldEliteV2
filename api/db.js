
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
        },
        {
            provider: 'setu',
            config: JSON.stringify({
                clientId: process.env.SETU_CLIENT_ID || 'default_client_id',
                secret: process.env.SETU_SECRET || 'default_secret',
                schemeId: process.env.SETU_SCHEME_ID || 'default_scheme_id'
            })
        }
    ],
    system_activities: [],
    system_errors: [],
    whatsapp_logs: []
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
            port: parseInt(process.env.DB_PORT || '3306'),
            waitForConnections: true,
            connectionLimit: 5,
            connectTimeout: 10000,
            enableKeepAlive: true,
            ssl: process.env.DB_SSL === 'true' ? {
                rejectUnauthorized: false // Often needed for cloud DBs
            } : undefined
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
            )`,
            `CREATE TABLE IF NOT EXISTS payment_schedules (
                id VARCHAR(100) PRIMARY KEY,
                orderId VARCHAR(100),
                dueDate DATETIME,
                targetAmount DECIMAL(10, 2),
                cumulativeTarget DECIMAL(10, 2),
                status VARCHAR(50),
                warningCount INT DEFAULT 0,
                FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS webhook_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                provider VARCHAR(50),
                event_type VARCHAR(100),
                payload LONGTEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];
        for (const sql of tables) await connection.query(sql);
        
        try {
            await connection.query("ALTER TABLE gold_rates ADD COLUMN rateSilver DECIMAL(10, 2) DEFAULT 0");
        } catch (e) { }
        try {
            await connection.query("ALTER TABLE orders ADD COLUMN share_token VARCHAR(100)");
            await connection.query("CREATE INDEX idx_share_token ON orders(share_token)");
            
            // Migration: populate share_token for existing orders
            const [orders] = await connection.query("SELECT id, data FROM orders WHERE share_token IS NULL");
            for (const order of orders) {
                try {
                    const data = JSON.parse(order.data);
                    if (data.shareToken) {
                        await connection.query("UPDATE orders SET share_token = ? WHERE id = ?", [data.shareToken, order.id]);
                    }
                } catch (e) {
                    console.error(`[DB] Failed to migrate order ${order.id}:`, e.message);
                }
            }
        } catch (e) { }

        // --- COMPREHENSIVE DATA MIGRATION ---
        try {
            console.log("[DB] Starting comprehensive data migration...");
            
            // 1. Create independent tables for Customers and Payments
            await connection.query(`CREATE TABLE IF NOT EXISTS payments_log (
                id VARCHAR(100) PRIMARY KEY,
                order_id VARCHAR(100),
                customer_contact VARCHAR(50),
                amount DECIMAL(10, 2),
                method VARCHAR(50),
                status VARCHAR(50),
                timestamp DATETIME,
                data LONGTEXT
            )`);

            // Also add an order_id column to whatsapp_logs to allow for tighter linkage
            try { await connection.query("ALTER TABLE whatsapp_logs ADD COLUMN order_id VARCHAR(100)"); } catch(e){}
            try { await connection.query("CREATE INDEX idx_whatsapp_order ON whatsapp_logs(order_id)"); } catch(e){}
            try { await connection.query("CREATE INDEX idx_payments_order ON payments_log(order_id)"); } catch(e){}
            try { await connection.query("CREATE INDEX idx_payments_contact ON payments_log(customer_contact)"); } catch(e){}
            
            // 2. Fetch all orders and migrate implicit data
            const [allOrders] = await connection.query("SELECT id, data FROM orders");
            
            for (const row of allOrders) {
                try {
                    const orderData = JSON.parse(row.data);
                    
                    // A. Migrate Customers from Orders
                    if (orderData.customerContact) {
                        const customId = `CUST-${orderData.customerContact.replace(/\D/g, '').slice(-10)}`;
                        const customerData = {
                            id: customId,
                            name: orderData.customerName || 'Unknown',
                            contact: orderData.customerContact,
                            email: orderData.customerEmail || '',
                            secondaryContact: orderData.secondaryContact || '',
                            joinDate: orderData.createdAt
                        };
                        
                        await connection.query(
                            `INSERT INTO customers (id, contact, name, data, updated_at) 
                             VALUES (?, ?, ?, ?, ?) 
                             ON DUPLICATE KEY UPDATE name=VALUES(name), data=VALUES(data)`,
                            [customId, orderData.customerContact, orderData.customerName || 'Unknown', JSON.stringify(customerData), Date.now()]
                        );
                    }
                    
                    // B. Migrate Payments from Orders
                    if (Array.isArray(orderData.payments)) {
                        for (const payment of orderData.payments) {
                            if (!payment.id) continue;
                            await connection.query(
                                `INSERT INTO payments_log (id, order_id, customer_contact, amount, method, status, timestamp, data) 
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                 ON DUPLICATE KEY UPDATE status=VALUES(status), data=VALUES(data)`,
                                [
                                    payment.id, 
                                    orderData.id, 
                                    orderData.customerContact,
                                    payment.amount || 0,
                                    payment.method || 'Unknown',
                                    payment.status || 'SUCCESS',
                                    new Date(payment.timestamp || Date.now()),
                                    JSON.stringify(payment)
                                ]
                            );
                        }
                    }
                } catch (e) {
                    console.error(`[DB] Failed to process order ${row.id}: `, e.message);
                }
            }
            console.log("[DB] Finished data migration successfully.");
        } catch(e) {
            console.error("[DB] Migration failed:", e.message);
        }

        // --- CLEANUP ORPHANED ROWS ---
        try {
            await connection.query("DELETE FROM payment_schedules WHERE orderId NOT IN (SELECT id FROM orders)");
        } catch(e) {
            console.warn("[DB] Cleanup of orphaned payment schedules failed:", e.message);
        }

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

        // --- SEED DEFAULT SETU CONFIG ---
        const [setuConfig] = await connection.query("SELECT * FROM integrations WHERE provider = ?", ['setu']);
        if (setuConfig.length === 0) {
            console.log("[DB] Seeding default Setu config...");
            await connection.query(
                "INSERT INTO integrations (provider, config) VALUES (?, ?)",
                ['setu', JSON.stringify({
                    clientId: process.env.SETU_CLIENT_ID || 'default_client_id',
                    secret: process.env.SETU_SECRET || 'default_secret',
                    schemeId: process.env.SETU_SCHEME_ID || 'default_scheme_id'
                })]
            );
        }

        connection.release();
        return { success: true };
    } catch (err) {
        console.error("[DB] Connection Error:", err.message);
        console.warn("[DB] Falling back to Mock Database due to connection failure.");
        isMock = true;
        pool = null; 
        return { success: true, mock: true, error: err.message };
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
                    if (lowerSql.includes('insert into integrations')) {
                        const index = mockData.integrations.findIndex(i => i.provider === params[0]);
                        if (index > -1) {
                            mockData.integrations[index].config = params[1];
                        } else {
                            mockData.integrations.push({ provider: params[0], config: params[1] });
                        }
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('update integrations set config = ? where provider = ?')) {
                        const index = mockData.integrations.findIndex(i => i.provider === params[1]);
                        if (index > -1) mockData.integrations[index].config = params[0];
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('insert into whatsapp_logs')) {
                        const existingIndex = mockData.whatsapp_logs.findIndex(l => l.id === params[0]);
                        if (existingIndex > -1) {
                            mockData.whatsapp_logs[existingIndex].data = params[4];
                        } else {
                            mockData.whatsapp_logs.push({ id: params[0], phone: params[1], direction: params[2], timestamp: params[3], data: params[4] });
                        }
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('select data from whatsapp_logs')) {
                        if (lowerSql.includes('where id = ?')) {
                            const log = mockData.whatsapp_logs.find(l => l.id === params[0]);
                            return [log ? [log] : []];
                        }
                        const sorted = [...mockData.whatsapp_logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 150);
                        return [sorted];
                    }
                    if (lowerSql.includes('update whatsapp_logs set data = ? where id = ?')) {
                        const index = mockData.whatsapp_logs.findIndex(l => l.id === params[1]);
                        if (index > -1) mockData.whatsapp_logs[index].data = params[0];
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
        if (!result.success) {
            return res.status(503).json({ 
                error: "Database Unavailable", 
                details: result.error,
                help: "Please check your DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME environment variables. If you intended to use the mock database, ensure DB_HOST is empty or set to 'localhost' inside AI Studio."
            });
        }
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
