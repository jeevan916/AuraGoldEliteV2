
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let pool = null;
export let isMock = false;
export let lastDbError = null;
const envAdminUsername = process.env.APP_ADMIN || 'admin';
const initialAdminPassword = process.env.APP_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || '';
const initialAdminHash = initialAdminPassword ? bcrypt.hashSync(initialAdminPassword, 10) : '';

export const mockData = {
    gold_rates: [],
    plan_templates: [],
    external_payments: [],
    orders: [],
    customers: [],
    catalog: [],
    templates: [],
    payment_schedules: [],
    system_errors: [],
    system_activities: [],
    webhook_logs: [],
    whatsapp_logs: [],
    app_users: [{ id: 1, username: envAdminUsername, password_hash: initialAdminHash, role: 'ADMIN', mobile_number: '' }],
    integrations: [
        { 
            id: 1,
            provider: 'core_settings', 
            enabled: 1,
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
            id: 2,
            provider: 'setu',
            enabled: process.env.SETU_CLIENT_ID && process.env.SETU_SECRET ? 1 : 0,
            config: JSON.stringify({
                clientId: process.env.SETU_CLIENT_ID || '',
                secret: process.env.SETU_SECRET || '',
                schemeId: process.env.SETU_SCHEME_ID || '',
                mode: process.env.SETU_MODE || 'PRODUCTION',
                enabled: !!(process.env.SETU_CLIENT_ID && process.env.SETU_SECRET)
            })
        }
    ],
    system_activities: [],
    system_errors: [],
    whatsapp_logs: [],
    payments_log: []
};

export async function initDb() {
    const host = process.env.DB_HOST;
    // Only fallback to mock if host is missing, OR if we are inside AI Studio and trying to use localhost
    if (!host || (process.env.APPLET_ID && (host === '127.0.0.1' || host === 'localhost'))) {
        console.warn("[DB] No external DB_HOST provided. Operating in Mock Database mode.");
        isMock = true;
        if (pool) {
            try { await pool.end(); } catch (e) {}
            pool = null;
        }
        return { success: true, mock: true };
    }

    let tempPool = null;
    try {
        const dbConfig = {
            host: host,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT || '3306'),
            socketPath: process.env.DB_SOCKET_PATH || undefined,
            waitForConnections: true,
            connectionLimit: 5,
            connectTimeout: 5000,
            enableKeepAlive: true,
            ssl: process.env.DB_SSL === 'true' ? {
                rejectUnauthorized: false
            } : undefined
        };
        tempPool = mysql.createPool(dbConfig);
        const connection = await tempPool.getConnection();
        console.log(`[DB] Successfully connected to MySQL at ${host}`);
        
        const tables = [
            `CREATE TABLE IF NOT EXISTS gold_rates (id INT AUTO_INCREMENT PRIMARY KEY, rate24k DECIMAL(10, 2), rate22k DECIMAL(10, 2), rate18k DECIMAL(10, 2), rateSilver DECIMAL(10, 2) DEFAULT 0, recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS integrations (provider VARCHAR(50) PRIMARY KEY, config JSON, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
            `CREATE TABLE IF NOT EXISTS app_config (setting_key VARCHAR(50) PRIMARY KEY, setting_value VARCHAR(255))`,
            `CREATE TABLE IF NOT EXISTS customers (id VARCHAR(100) PRIMARY KEY, contact VARCHAR(50), name VARCHAR(255), data LONGTEXT, updated_at BIGINT)`,
            `CREATE TABLE IF NOT EXISTS orders (id VARCHAR(100) PRIMARY KEY, customer_contact VARCHAR(50), status VARCHAR(50), created_at DATETIME, share_token VARCHAR(100), data LONGTEXT, updated_at BIGINT)`,
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
                mobile_number VARCHAR(20) DEFAULT '',
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
            )`,
            `CREATE TABLE IF NOT EXISTS system_backups (
                id VARCHAR(100) PRIMARY KEY,
                filename VARCHAR(255),
                backup_type VARCHAR(50),
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                db_data LONGTEXT,
                app_meta LONGTEXT
            )`,
            `CREATE TABLE IF NOT EXISTS transaction_journal (
                id VARCHAR(100) PRIMARY KEY,
                entity_type VARCHAR(50),
                entity_id VARCHAR(100),
                action VARCHAR(50),
                payload LONGTEXT,
                checksum VARCHAR(64),
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS external_payments (
                id VARCHAR(100) PRIMARY KEY,
                customer_contact VARCHAR(50),
                status VARCHAR(50),
                created_at DATETIME,
                share_token VARCHAR(100),
                data LONGTEXT,
                updated_at BIGINT
            )`,
            `CREATE TABLE IF NOT EXISTS payments_log (
                id VARCHAR(100) PRIMARY KEY,
                order_id VARCHAR(100),
                customer_contact VARCHAR(50),
                amount DECIMAL(10, 2),
                method VARCHAR(50),
                status VARCHAR(50),
                timestamp DATETIME,
                data LONGTEXT
            )`,
            `CREATE TABLE IF NOT EXISTS salesman_estimates (
                id VARCHAR(100) PRIMARY KEY,
                customer_name VARCHAR(255),
                customer_contact VARCHAR(50),
                gross_amount DECIMAL(12, 2) DEFAULT 0,
                net_payable DECIMAL(12, 2) DEFAULT 0,
                created_at DATETIME,
                data LONGTEXT,
                updated_at BIGINT
            )`
        ];
        for (const sql of tables) await connection.query(sql);
        
        try {
            await connection.query("ALTER TABLE gold_rates ADD COLUMN rateSilver DECIMAL(10, 2) DEFAULT 0");
        } catch (e) { }
        try {
            await connection.query("ALTER TABLE app_users ADD COLUMN mobile_number VARCHAR(20) DEFAULT ''");
        } catch (e) { }
        try {
            await connection.query("ALTER TABLE orders ADD COLUMN share_token VARCHAR(100)");
            await connection.query("CREATE INDEX idx_share_token ON orders(share_token)");
        } catch (e) { }

        try {
            await connection.query("ALTER TABLE external_payments ADD COLUMN share_token VARCHAR(100)");
            await connection.query("CREATE INDEX idx_ext_share_token ON external_payments(share_token)");
        } catch (e) { }
        
        try {
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

        try {
            // Migration: populate share_token for existing external payments
            const [exts] = await connection.query("SELECT id, data FROM external_payments WHERE share_token IS NULL OR share_token = ''");
            for (const ext of exts) {
                try {
                    const data = typeof ext.data === 'string' ? JSON.parse(ext.data) : ext.data;
                    if (data && (data.shareToken || data.share_token)) {
                        await connection.query("UPDATE external_payments SET share_token = ? WHERE id = ?", [data.shareToken || data.share_token, ext.id]);
                    }
                } catch (e) {
                    console.error(`[DB] Failed to migrate external payment ${ext.id}:`, e.message);
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
            
            // 2. Fetch all orders and migrate implicit data only if customers table is unpopulated
            const [custCheck] = await connection.query("SELECT COUNT(*) as cnt FROM customers");
            if ((custCheck[0]?.cnt || 0) === 0) {
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
            }
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
        const adminUsername = process.env.APP_ADMIN || 'admin';
        const adminPassword = process.env.APP_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD;
        const [users] = await connection.query("SELECT * FROM app_users WHERE username = ?", [adminUsername]);
        if (users.length === 0) {
            console.log(`[DB] Seeding initial admin user (${adminUsername})...`);
            const hash = adminPassword ? await bcrypt.hash(adminPassword, 10) : '';
            await connection.query(
                "INSERT INTO app_users (username, password_hash, role) VALUES (?, ?, ?)",
                [adminUsername, hash, 'ADMIN']
            );
        }

        // --- SEED DEFAULT SETU CONFIG ---
        const [setuConfig] = await connection.query("SELECT * FROM integrations WHERE provider = ?", ['setu']);
        if (setuConfig.length === 0) {
            console.log("[DB] Seeding initial Setu config...");
            await connection.query(
                "INSERT INTO integrations (provider, config) VALUES (?, ?)",
                ['setu', JSON.stringify({
                    clientId: process.env.SETU_CLIENT_ID || '',
                    secret: process.env.SETU_SECRET || '',
                    schemeId: process.env.SETU_SCHEME_ID || ''
                })]
            );
        }

        connection.release();
        
        // Swap to the new pool cleanly
        const oldPool = pool;
        pool = tempPool;
        isMock = false;
        lastDbError = null;
        if (oldPool && oldPool !== pool) {
            try { await oldPool.end(); } catch (e) {}
        }
        console.log(`[DB] Successfully connected to MySQL at ${host}`);
        return { success: true, mock: false };
    } catch (err) {
        lastDbError = err.message || String(err);
        console.error("[DB] Connection Error:", err.message);
        console.warn("[DB] Falling back to Mock Database due to connection failure.");
        if (tempPool) {
            try { await tempPool.end(); } catch (e) {}
        }
        if (pool) {
            try { await pool.end(); } catch (e) {}
            pool = null;
        }
        isMock = true;
        return { success: true, mock: true, error: err.message };
    }
}

export const getPool = () => {
    if (isMock || !pool) {
        return {
            getConnection: async () => ({
                query: async (sql, params = []) => {
                    const lowerSql = sql.toLowerCase();
                    
                    if (lowerSql.includes('select 1') || lowerSql.includes('select @@version')) {
                        return [[{ 1: 1 }]];
                    }
                    if (lowerSql.includes('select * from app_users where username = ?')) {
                        const user = mockData.app_users.find(u => u.username === params[0]);
                        return [user ? [user] : []];
                    }
                    if (lowerSql.includes('select') && lowerSql.includes('from app_users')) {
                        return [mockData.app_users.map(u => ({ id: u.id, username: u.username, role: u.role, mobile_number: u.mobile_number || '', created_at: u.created_at || new Date().toISOString() }))];
                    }
                    if (lowerSql.includes('insert into app_users')) {
                        const newUser = {
                            id: Date.now(),
                            username: params[0],
                            password_hash: params[1],
                            role: params[2],
                            mobile_number: params[3] || '',
                            created_at: new Date().toISOString()
                        };
                        mockData.app_users.push(newUser);
                        return [{ affectedRows: 1, insertId: newUser.id }];
                    }
                    if (lowerSql.includes('update app_users')) {
                        if (lowerSql.includes('password_hash = ?') && lowerSql.includes('role = ?')) {
                            const index = mockData.app_users.findIndex(u => u.id == params[3]);
                            if (index > -1) {
                                mockData.app_users[index].role = params[0];
                                mockData.app_users[index].mobile_number = params[1];
                                mockData.app_users[index].password_hash = params[2];
                            }
                        } else if (lowerSql.includes('password_hash = ?')) {
                            const index = mockData.app_users.findIndex(u => u.id == params[1]);
                            if (index > -1) {
                                mockData.app_users[index].password_hash = params[0];
                            }
                        } else if (lowerSql.includes('role = ?') && lowerSql.includes('mobile_number = ?')) {
                            const index = mockData.app_users.findIndex(u => u.id == params[2]);
                            if (index > -1) {
                                mockData.app_users[index].role = params[0];
                                mockData.app_users[index].mobile_number = params[1];
                            }
                        } else if (lowerSql.includes('role = ?')) {
                            const index = mockData.app_users.findIndex(u => u.id == params[1]);
                            if (index > -1) {
                                mockData.app_users[index].role = params[0];
                            }
                        }
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('delete from app_users')) {
                        const index = mockData.app_users.findIndex(u => u.id == params[0]);
                        if (index > -1) {
                            mockData.app_users.splice(index, 1);
                        }
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('from integrations')) {
                        if (lowerSql.includes('where provider = ?')) {
                            const row = (mockData.integrations || []).find(i => i.provider === params[0]);
                            return [row ? [row] : []];
                        }
                        return [mockData.integrations || []];
                    }
                    if (lowerSql.includes('insert into system_activities')) {
                        const newAct = {
                            id: params[0] || `ACT-${Date.now()}`,
                            action_type: params[1] || 'INFO',
                            details: params[2] || '',
                            metadata: typeof params[3] === 'string' ? JSON.parse(params[3] || '{}') : (params[3] || {}),
                            ip_address: params[4] || '127.0.0.1',
                            geo_location: params[5] || 'Local Network',
                            device_info: params[6] || 'Desktop',
                            timestamp: params[7] || new Date().toISOString()
                        };
                        if (!mockData.system_activities) mockData.system_activities = [];
                        mockData.system_activities.unshift(newAct);
                        if (mockData.system_activities.length > 300) mockData.system_activities.pop();
                        return [{ affectedRows: 1, insertId: Date.now() }];
                    }
                    if (lowerSql.includes('select * from system_activities') || lowerSql.includes('select') && lowerSql.includes('from system_activities')) {
                        return [mockData.system_activities || []];
                    }
                    if (lowerSql.includes('insert into system_errors')) {
                        const newErr = {
                            id: params[0] || `ERR-${Date.now()}`,
                            source: params[1] || 'App',
                            message: params[2] || '',
                            stack: params[3] || '',
                            severity: params[4] || 'MEDIUM',
                            timestamp: params[5] || new Date().toISOString(),
                            context: typeof params[6] === 'string' ? JSON.parse(params[6] || '{}') : (params[6] || {})
                        };
                        if (!mockData.system_errors) mockData.system_errors = [];
                        mockData.system_errors.unshift(newErr);
                        if (mockData.system_errors.length > 200) mockData.system_errors.pop();
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('select * from system_errors') || lowerSql.includes('select') && lowerSql.includes('from system_errors')) {
                        return [mockData.system_errors || []];
                    }
                    if (lowerSql.includes('insert into webhook_logs')) {
                        const newWl = {
                            id: params[0] || `WH-${Date.now()}`,
                            provider: params[1],
                            event_type: params[2],
                            payload: params[3],
                            headers: params[4],
                            status: params[5],
                            error_message: params[6],
                            created_at: new Date().toISOString()
                        };
                        if (!mockData.webhook_logs) mockData.webhook_logs = [];
                        mockData.webhook_logs.unshift(newWl);
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('select * from webhook_logs') || lowerSql.includes('from webhook_logs')) {
                        return [mockData.webhook_logs || []];
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
                            mockData.whatsapp_logs[existingIndex].data = params[params.length - 1];
                        } else {
                            mockData.whatsapp_logs.push({ id: params[0], phone: params[1], direction: params[3], timestamp: params[4], data: params[params.length - 1] });
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
                    if (lowerSql.includes('select data from plan_templates') || lowerSql.includes('select * from plan_templates')) {
                        return [mockData.plan_templates || []];
                    }
                    if (lowerSql.includes('delete from plan_templates')) {
                        mockData.plan_templates = [];
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('insert into plan_templates')) {
                        mockData.plan_templates.push({ id: params[0], name: params[1], data: params[params.length - 1] });
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('select * from transaction_journal')) {
                        const journal = mockData.transaction_journal || [];
                        const sorted = [...journal].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                        return [sorted];
                    }
                    if (lowerSql.includes('insert into transaction_journal')) {
                        const newEntry = {
                            id: params[0],
                            entity_type: params[1],
                            entity_id: params[2],
                            action: params[3],
                            payload: params[4],
                            checksum: params[5],
                            timestamp: params[6] || new Date().toISOString()
                        };
                        if (!mockData.transaction_journal) mockData.transaction_journal = [];
                        mockData.transaction_journal.push(newEntry);
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('insert into payments_log')) {
                        const newLog = {
                            id: params[0],
                            order_id: params[1],
                            customer_contact: params[2],
                            amount: params[3],
                            method: params[4],
                            status: params[5],
                            timestamp: params[6],
                            data: params[params.length - 1]
                        };
                        if (!mockData.payments_log) mockData.payments_log = [];
                        const existingIdx = mockData.payments_log.findIndex(p => p.id === newLog.id);
                        if (existingIdx > -1) {
                            mockData.payments_log[existingIdx] = newLog;
                        } else {
                            mockData.payments_log.push(newLog);
                        }
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('select data from payments_log where order_id = ?')) {
                        const logs = (mockData.payments_log || []).filter(p => p.order_id === params[0]);
                        return [logs.map(l => ({ data: l.data }))];
                    }
                    if (lowerSql.includes('select order_id, data from payments_log')) {
                        const logs = mockData.payments_log || [];
                        return [logs.map(l => ({ order_id: l.order_id, data: l.data }))];
                    }
                    if (lowerSql.includes('select data from payments_log')) {
                        const logs = mockData.payments_log || [];
                        return [logs.map(l => ({ data: l.data }))];
                    }
                    if (lowerSql.includes('select data from orders where id = ?') || lowerSql.includes('select data from orders where share_token = ?')) {
                        const ord = (mockData.orders || []).find(o => o.id === params[0] || o.share_token === params[0]);
                        return [ord ? [{ data: ord.data }] : []];
                    }
                    if (lowerSql.includes('select data from orders') || lowerSql.includes('select * from orders')) {
                        return [(mockData.orders || []).map(o => ({ data: o.data, id: o.id, status: o.status }))];
                    }
                    if (lowerSql.includes('insert into orders')) {
                        const newOrd = { id: params[0], customer_contact: params[1], status: params[2], share_token: params[4], data: params[5], updated_at: params[6] };
                        if (!mockData.orders) mockData.orders = [];
                        const idx = mockData.orders.findIndex(o => o.id === newOrd.id);
                        if (idx > -1) mockData.orders[idx] = newOrd;
                        else mockData.orders.push(newOrd);
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('select data from customers')) {
                        if (lowerSql.includes('where id = ?') || lowerSql.includes('where contact = ?')) {
                            const c = (mockData.customers || []).find(cust => cust.id === params[0] || cust.contact === params[0]);
                            return [c ? [{ data: c.data }] : []];
                        }
                        return [(mockData.customers || []).map(c => ({ data: c.data }))];
                    }
                    if (lowerSql.includes('insert into customers')) {
                        const newCust = { id: params[0], contact: params[1], name: params[2], data: params[3], updated_at: params[4] };
                        if (!mockData.customers) mockData.customers = [];
                        const idx = mockData.customers.findIndex(c => c.id === newCust.id);
                        if (idx > -1) mockData.customers[idx] = newCust;
                        else mockData.customers.push(newCust);
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('select data from catalog') || lowerSql.includes('select * from catalog')) {
                        return [(mockData.catalog || []).map(c => ({ data: c.data }))];
                    }
                    if (lowerSql.includes('insert into catalog')) {
                        if (!mockData.catalog) mockData.catalog = [];
                        mockData.catalog.push({ id: params[0], category: params[1], data: params[2] });
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('select data from templates') || lowerSql.includes('select * from templates')) {
                        return [(mockData.templates || []).map(t => ({ data: t.data }))];
                    }
                    if (lowerSql.includes('insert into templates')) {
                        if (!mockData.templates) mockData.templates = [];
                        mockData.templates.push({ id: params[0], name: params[1], category: params[2], data: params[3] });
                        return [{ affectedRows: 1 }];
                    }
                    if (lowerSql.includes('select data from external_payments where share_token = ?')) {
                        const ext = (mockData.external_payments || []).find(e => e.share_token === params[0]);
                        return [ext ? [{ data: ext.data }] : []];
                    }
                    if (lowerSql.includes('select data from external_payments where id = ?')) {
                        const ext = (mockData.external_payments || []).find(e => e.id === params[0]);
                        return [ext ? [{ data: ext.data }] : []];
                    }
                    if (lowerSql.includes('select * from external_payments') || lowerSql.includes('select data from external_payments')) {
                        return [(mockData.external_payments || []).map(e => ({ id: e.id, data: e.data }))];
                    }
                    if (lowerSql.includes('insert into external_payments')) {
                        const newExt = { id: params[0], customer_contact: params[1], status: params[2], share_token: params[4], data: params[5], updated_at: params[6] };
                        if (!mockData.external_payments) mockData.external_payments = [];
                        const idx = mockData.external_payments.findIndex(e => e.id === newExt.id);
                        if (idx > -1) mockData.external_payments[idx] = newExt;
                        else mockData.external_payments.push(newExt);
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
    try {
        const poolInstance = getPool();
        if (!poolInstance) return;

        const ip = req ? (req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() : 'System';
        const userAgent = req ? (req.get ? req.get('User-Agent') : req.headers?.['user-agent']) || 'Internal Process' : 'Internal Process';
        
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
            referer: req && req.get ? req.get('Referer') : undefined,
            platform: typeof userAgent === 'string' && userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
        };

        const connection = await poolInstance.getConnection();
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
                (userAgent || '').substring(0, 250), // Truncate to fit
                new Date()
            ]
        );
        connection.release();
    } catch (e) {
        // Silently capture activity logging errors to prevent request disruption
    }
};

const JOURNAL_FILE_PATH = path.resolve(process.cwd(), 'backups', 'live_journal_mirror.log');

export async function journalTransaction(entityType, entityId, action, payload, connection = null) {
    const id = `TX-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const timestamp = new Date();
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    const checksum = crypto.createHash('sha256').update(payloadStr).digest('hex');
    
    const journalEntry = {
        id,
        entity_type: entityType,
        entity_id: entityId,
        action,
        payload: payloadStr,
        checksum,
        timestamp: timestamp.toISOString()
    };
    
    // 1. Dual-layer: Mirror to the physical local disk mirror log
    try {
        const backupsDir = path.resolve(process.cwd(), 'backups');
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }
        fs.appendFileSync(JOURNAL_FILE_PATH, JSON.stringify(journalEntry) + '\n', 'utf8');
    } catch (err) {
        console.error("[Journal] Local file mirroring failed:", err.message);
    }
    
    // 2. Dual-layer: Write to relational database
    try {
        if (isMock) {
            if (!mockData.transaction_journal) {
                mockData.transaction_journal = [];
            }
            mockData.transaction_journal.push(journalEntry);
        } else {
            const activeConn = connection || await getPool().getConnection();
            try {
                await activeConn.query(
                    `INSERT INTO transaction_journal (id, entity_type, entity_id, action, payload, checksum, timestamp) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [id, entityType, entityId, action, payloadStr, checksum, timestamp]
                );
            } finally {
                if (!connection) activeConn.release();
            }
        }
    } catch (err) {
        console.error("[Journal] Relational table mirroring failed:", err.message);
    }
    
    return journalEntry;
}
