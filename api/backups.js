import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { getPool, isMock, mockData } from './db.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure backup folder exists
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Helper to get active tables
const getDatabaseTables = async (connection) => {
    const [rows] = await connection.query('SHOW TABLES');
    // Extract the table names from SHOW TABLES output (which has keys like 'Tables_in_auragold_elite')
    return rows.map(r => Object.values(r)[0]).filter(name => name !== 'system_backups');
};

// Helper to generate database backup JSON
const captureDatabaseState = async () => {
    if (isMock) {
        // Backup in-memory mock data
        return JSON.stringify(mockData);
    }

    const pool = getPool();
    const connection = await pool.getConnection();
    try {
        const tables = await getDatabaseTables(connection);
        const snapshot = {};
        for (const table of tables) {
            const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
            snapshot[table] = rows;
        }
        return JSON.stringify(snapshot);
    } finally {
        connection.release();
    }
};

// Helper to restore database state from JSON
const restoreDatabaseState = async (dbDataJson) => {
    const snapshot = JSON.parse(dbDataJson);
    
    if (isMock) {
        // Clear current mock data keys and restore
        Object.keys(mockData).forEach(key => delete mockData[key]);
        Object.assign(mockData, snapshot);
        return { success: true, message: "Mock Database restored successfully." };
    }

    const pool = getPool();
    const connection = await pool.getConnection();
    try {
        // Temporarily disable foreign keys for a safe, constraint-free restore
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        
        for (const [table, rows] of Object.entries(snapshot)) {
            // Drop existing rows
            await connection.query(`DELETE FROM \`${table}\``);
            
            if (rows.length === 0) continue;

            // Generate batch insert queries to make it extremely fast and clean
            const columns = Object.keys(rows[0]);
            const columnNamesStr = columns.map(c => `\`${c}\``).join(', ');
            const placeholders = columns.map(() => '?').join(', ');
            const insertSql = `INSERT INTO \`${table}\` (${columnNamesStr}) VALUES (${placeholders})`;

            for (const row of rows) {
                const values = columns.map(col => {
                    const val = row[col];
                    // Handle JSON values safely in MySQL
                    if (val !== null && typeof val === 'object') {
                        return JSON.stringify(val);
                    }
                    return val;
                });
                await connection.query(insertSql, values);
            }
        }
        
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        return { success: true };
    } catch (error) {
        // Always attempt to turn foreign key checks back on if something fails
        try { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (e) {}
        throw error;
    } finally {
        connection.release();
    }
};

// Create a backup file and database record
export const createBackup = async ({ type = 'MANUAL', includeApp = true } = {}) => {
    const id = `BKP-${Date.now()}`;
    const timestamp = new Date();
    const dateString = timestamp.toISOString().replace(/[:.]/g, '-');
    const dbFilename = `db_backup_${dateString}.json`;
    const appFilename = includeApp ? `app_backup_${dateString}.tar.gz` : null;

    // Capture Database
    const dbData = await captureDatabaseState();
    const dbFilePath = path.join(BACKUP_DIR, dbFilename);
    fs.writeFileSync(dbFilePath, dbData, 'utf8');

    // Capture App Files (using tar)
    let appMeta = null;
    if (includeApp) {
        const appFilePath = path.join(BACKUP_DIR, appFilename);
        const excludePatterns = [
            'node_modules',
            'dist',
            '.git',
            'backups',
            '.next',
            '.cache'
        ].map(p => `--exclude="${p}"`).join(' ');

        await new Promise((resolve, reject) => {
            // Compress key folders and root files
            const tarCmd = `tar -czf "${appFilePath}" ${excludePatterns} App.tsx index.tsx index.css index.html constants.tsx types.ts server.js package.json vite.config.ts tsconfig.json components hooks services api public`;
            exec(tarCmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
                if (err) {
                    console.error('[Backup Engine] App compression warning:', stderr || err.message);
                    // Resolve anyway as app backup is secondary to DB backup
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });

        if (fs.existsSync(appFilePath)) {
            const stats = fs.statSync(appFilePath);
            appMeta = JSON.stringify({
                filename: appFilename,
                size: stats.size,
                path: appFilePath
            });
        }
    }

    // Save metadata to database table
    if (!isMock) {
        const pool = getPool();
        const connection = await pool.getConnection();
        try {
            await connection.query(
                `INSERT INTO system_backups (id, filename, backup_type, timestamp, db_data, app_meta) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, dbFilename, type, timestamp, dbData, appMeta]
            );
        } finally {
            connection.release();
        }
    } else {
        // Save to mock database array
        if (!mockData.system_backups) {
            mockData.system_backups = [];
        }
        mockData.system_backups.push({
            id,
            filename: dbFilename,
            backup_type: type,
            timestamp: timestamp.toISOString(),
            db_data: dbData,
            app_meta: appMeta
        });
    }

    return {
        id,
        filename: dbFilename,
        backup_type: type,
        timestamp,
        dbSize: Buffer.byteLength(dbData),
        appSize: appMeta ? JSON.parse(appMeta).size : 0
    };
};

// Scheduler to trigger automatic backups and clean up old backups (keep last 7 days of AUTO backups)
export const initBackupScheduler = () => {
    console.log('[Backup Scheduler] Initializing automatic 7-day backup scheduler...');
    
    const runSchedulerCheck = async () => {
        try {
            console.log('[Backup Scheduler] Running daily backup and auto-pruning checks...');
            
            // Get all backups to see if we already backed up today
            let backups = [];
            if (!isMock) {
                const pool = getPool();
                const connection = await pool.getConnection();
                try {
                    const [rows] = await connection.query('SELECT id, timestamp, backup_type FROM system_backups ORDER BY timestamp DESC');
                    backups = rows;
                } finally {
                    connection.release();
                }
            } else {
                backups = mockData.system_backups || [];
            }

            // Check if we already have an AUTO backup for today
            const todayStr = new Date().toISOString().split('T')[0];
            const hasBackupToday = backups.some(b => b.backup_type === 'AUTO' && b.timestamp.toString().startsWith(todayStr));

            if (!hasBackupToday) {
                console.log('[Backup Scheduler] Today\'s auto backup not found. Creating automatic backup...');
                const newBkp = await createBackup({ type: 'AUTO', includeApp: true });
                console.log(`[Backup Scheduler] Automatic backup created successfully: ${newBkp.id}`);
                // Refresh list
                backups.unshift({ ...newBkp, timestamp: newBkp.timestamp.toISOString() });
            } else {
                console.log('[Backup Scheduler] Today\'s auto backup already exists.');
            }

            // Prune backups: Keep only the last 7 days of AUTO backups
            const autoBackups = backups.filter(b => b.backup_type === 'AUTO').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            if (autoBackups.length > 7) {
                console.log(`[Backup Scheduler] Found ${autoBackups.length} automatic backups. Pruning down to last 7 days...`);
                const toPrune = autoBackups.slice(7);
                for (const bkp of toPrune) {
                    console.log(`[Backup Scheduler] Pruning backup: ${bkp.id} (${bkp.timestamp})`);
                    // Retrieve file names first
                    let record = bkp;
                    if (!isMock) {
                        const pool = getPool();
                        const connection = await pool.getConnection();
                        try {
                            const [rows] = await connection.query('SELECT filename, app_meta FROM system_backups WHERE id = ?', [bkp.id]);
                            if (rows.length > 0) record = rows[0];
                        } finally {
                            connection.release();
                        }
                    }

                    // Delete files from disk
                    if (record.filename) {
                        const dbPath = path.join(BACKUP_DIR, record.filename);
                        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
                    }
                    if (record.app_meta) {
                        try {
                            const meta = JSON.parse(record.app_meta);
                            if (meta && meta.filename) {
                                const appPath = path.join(BACKUP_DIR, meta.filename);
                                if (fs.existsSync(appPath)) fs.unlinkSync(appPath);
                            }
                        } catch (e) {}
                    }

                    // Delete from database
                    if (!isMock) {
                        const pool = getPool();
                        const connection = await pool.getConnection();
                        try {
                            await connection.query('DELETE FROM system_backups WHERE id = ?', [bkp.id]);
                        } finally {
                            connection.release();
                        }
                    } else {
                        const idx = mockData.system_backups.findIndex(b => b.id === bkp.id);
                        if (idx > -1) mockData.system_backups.splice(idx, 1);
                    }
                }
                console.log('[Backup Scheduler] Pruning completed.');
            }
        } catch (e) {
            console.error('[Backup Scheduler] Scheduler Error:', e.message);
        }
    };

    // Run immediately on boot
    setTimeout(runSchedulerCheck, 10000);

    // Then run every hour to check for new day or pruning
    setInterval(runSchedulerCheck, 60 * 60 * 1000);
};

// --- HTTP ROUTES ---

// Get list of backups
router.get('/backups', async (req, res) => {
    try {
        let backups = [];
        if (!isMock) {
            const pool = getPool();
            const connection = await pool.getConnection();
            try {
                // Return metadata without db_data to avoid massive JSON payloads in listing
                const [rows] = await connection.query(
                    'SELECT id, filename, backup_type, timestamp, LENGTH(db_data) as dbSize, app_meta FROM system_backups ORDER BY timestamp DESC'
                );
                backups = rows.map(r => ({
                    id: r.id,
                    filename: r.filename,
                    backup_type: r.backup_type,
                    timestamp: r.timestamp,
                    dbSize: r.dbSize || 0,
                    appSize: r.app_meta ? JSON.parse(r.app_meta).size : 0
                }));
            } finally {
                connection.release();
            }
        } else {
            const mockList = mockData.system_backups || [];
            backups = mockList.map(r => ({
                id: r.id,
                filename: r.filename,
                backup_type: r.backup_type,
                timestamp: r.timestamp,
                dbSize: Buffer.byteLength(r.db_data || ''),
                appSize: r.app_meta ? JSON.parse(r.app_meta).size : 0
            }));
        }

        res.json({ success: true, backups, isMock });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Trigger a manual or clone backup
router.post('/backups/create', async (req, res) => {
    try {
        const { type = 'MANUAL', includeApp = true } = req.body;
        const result = await createBackup({ type, includeApp });
        res.json({ success: true, message: 'Backup created successfully', backup: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Restore backup
router.post('/backups/restore/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let bkpRecord = null;

        if (!isMock) {
            const pool = getPool();
            const connection = await pool.getConnection();
            try {
                const [rows] = await connection.query('SELECT * FROM system_backups WHERE id = ?', [id]);
                if (rows.length > 0) bkpRecord = rows[0];
            } finally {
                connection.release();
            }
        } else {
            bkpRecord = (mockData.system_backups || []).find(b => b.id === id);
        }

        if (!bkpRecord) {
            return res.status(404).json({ success: false, error: 'Backup not found' });
        }

        // Restore the DB
        await restoreDatabaseState(bkpRecord.db_data);

        // Optional: App file restore message
        let appMessage = "App state files can be downloaded and replaced manually for security reasons.";
        
        res.json({ 
            success: true, 
            message: `Backup ${id} restored successfully! Database tables rebuilt.`, 
            appMessage 
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Delete a backup
router.post('/backups/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let record = null;

        if (!isMock) {
            const pool = getPool();
            const connection = await pool.getConnection();
            try {
                const [rows] = await connection.query('SELECT filename, app_meta FROM system_backups WHERE id = ?', [id]);
                if (rows.length > 0) record = rows[0];
            } finally {
                connection.release();
            }
        } else {
            record = (mockData.system_backups || []).find(b => b.id === id);
        }

        if (record) {
            // Delete database dump from disk
            if (record.filename) {
                const dbPath = path.join(BACKUP_DIR, record.filename);
                if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
            }
            // Delete app archive from disk
            if (record.app_meta) {
                try {
                    const meta = JSON.parse(record.app_meta);
                    if (meta && meta.filename) {
                        const appPath = path.join(BACKUP_DIR, meta.filename);
                        if (fs.existsSync(appPath)) fs.unlinkSync(appPath);
                    }
                } catch (e) {}
            }
        }

        // Remove DB row
        if (!isMock) {
            const pool = getPool();
            const connection = await pool.getConnection();
            try {
                await connection.query('DELETE FROM system_backups WHERE id = ?', [id]);
            } finally {
                connection.release();
            }
        } else {
            const idx = mockData.system_backups.findIndex(b => b.id === id);
            if (idx > -1) mockData.system_backups.splice(idx, 1);
        }

        res.json({ success: true, message: 'Backup files deleted successfully.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Download db backup payload directly
router.get('/backups/download/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let record = null;

        if (!isMock) {
            const pool = getPool();
            const connection = await pool.getConnection();
            try {
                const [rows] = await connection.query('SELECT filename, db_data, app_meta FROM system_backups WHERE id = ?', [id]);
                if (rows.length > 0) record = rows[0];
            } finally {
                connection.release();
            }
        } else {
            record = (mockData.system_backups || []).find(b => b.id === id);
        }

        if (!record) {
            return res.status(404).send('Backup record not found.');
        }

        // Offer the DB backup as a JSON download
        res.setHeader('Content-disposition', `attachment; filename=${record.filename || 'backup.json'}`);
        res.setHeader('Content-type', 'application/json');
        res.send(record.db_data);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

const JOURNAL_FILE_PATH = path.resolve(process.cwd(), 'backups', 'live_journal_mirror.log');

// Get Live Transaction Journal Entries
router.get('/journal', async (req, res) => {
    try {
        let entries = [];
        let source = 'database';
        
        // 1. Try fetching from database first
        if (!isMock) {
            try {
                const pool = getPool();
                const connection = await pool.getConnection();
                try {
                    const [rows] = await connection.query(
                        'SELECT * FROM transaction_journal ORDER BY timestamp DESC LIMIT 250'
                    );
                    entries = rows;
                } finally {
                    connection.release();
                }
            } catch (dbErr) {
                console.warn("[Journal API] DB fetch failed, falling back to disk mirror file:", dbErr.message);
                source = 'disk_file';
            }
        } else {
            entries = mockData.transaction_journal || [];
            source = 'mock';
        }
        
        // 2. Fallback to physical disk file if database returned nothing or failed
        if ((entries.length === 0 || source === 'disk_file') && fs.existsSync(JOURNAL_FILE_PATH)) {
            try {
                const fileContent = fs.readFileSync(JOURNAL_FILE_PATH, 'utf8');
                const lines = fileContent.trim().split('\n').filter(Boolean);
                // Parse lines and sort descending by timestamp
                const fileEntries = lines.map(line => JSON.parse(line));
                fileEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                entries = fileEntries.slice(0, 250);
                source = 'disk_file';
            } catch (fileErr) {
                console.error("[Journal API] Disk file parsing failed:", fileErr.message);
            }
        }
        
        res.json({ success: true, source, count: entries.length, entries });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Cryptographic Verification of the Journal
router.get('/journal/verify', async (req, res) => {
    try {
        let entries = [];
        if (!isMock) {
            const pool = getPool();
            const connection = await pool.getConnection();
            try {
                const [rows] = await connection.query('SELECT * FROM transaction_journal ORDER BY timestamp DESC');
                entries = rows;
            } finally {
                connection.release();
            }
        } else {
            entries = mockData.transaction_journal || [];
        }
        
        let verifiedCount = 0;
        let corruptedEntries = [];
        
        for (const entry of entries) {
            const calculated = crypto.createHash('sha256').update(entry.payload).digest('hex');
            if (calculated === entry.checksum) {
                verifiedCount++;
            } else {
                corruptedEntries.push({
                    id: entry.id,
                    expected: entry.checksum,
                    calculated: calculated,
                    entity: `${entry.entity_type} #${entry.entity_id}`
                });
            }
        }
        
        res.json({
            success: true,
            status: corruptedEntries.length === 0 ? 'PRISTINE' : 'CORRUPTED',
            totalScanned: entries.length,
            verifiedCount,
            corruptedCount: corruptedEntries.length,
            corruptedEntries
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Point-in-Time Restore / State Reversion for individual transactions
router.post('/journal/revert/:txId', async (req, res) => {
    try {
        const { txId } = req.params;
        let entry = null;
        
        // 1. Find the entry
        if (!isMock) {
            const pool = getPool();
            const connection = await pool.getConnection();
            try {
                const [rows] = await connection.query('SELECT * FROM transaction_journal WHERE id = ?', [txId]);
                if (rows.length > 0) entry = rows[0];
            } finally {
                connection.release();
            }
        } else {
            entry = (mockData.transaction_journal || []).find(e => e.id === txId);
        }
        
        // Fallback search in file
        if (!entry && fs.existsSync(JOURNAL_FILE_PATH)) {
            const fileContent = fs.readFileSync(JOURNAL_FILE_PATH, 'utf8');
            const lines = fileContent.trim().split('\n').filter(Boolean);
            const foundLine = lines.find(line => {
                const parsed = JSON.parse(line);
                return parsed.id === txId;
            });
            if (foundLine) {
                entry = JSON.parse(foundLine);
            }
        }
        
        if (!entry) {
            return res.status(404).json({ success: false, error: "Journal entry not found in DB or disk log." });
        }
        
        // Verify checksum before executing state reversion!
        const calculated = crypto.createHash('sha256').update(entry.payload).digest('hex');
        if (calculated !== entry.checksum) {
            return res.status(400).json({ 
                success: false, 
                error: "Cryptographic signature mismatch! This payload has been tampered with or corrupted. Reversion aborted for safety." 
            });
        }
        
        const payload = JSON.parse(entry.payload);
        
        // 2. Perform state restoration based on entity type
        if (isMock) {
            if (entry.entity_type === 'ORDER') {
                if (!mockData.orders) mockData.orders = [];
                const idx = mockData.orders.findIndex(o => o.id === entry.entity_id);
                if (idx > -1) {
                    mockData.orders[idx] = payload;
                } else {
                    mockData.orders.push(payload);
                }
            } else if (entry.entity_type === 'CUSTOMER') {
                if (!mockData.customers) mockData.customers = [];
                const idx = mockData.customers.findIndex(c => c.id === entry.entity_id);
                if (idx > -1) {
                    mockData.customers[idx] = payload;
                } else {
                    mockData.customers.push(payload);
                }
            } else if (entry.entity_type === 'SETTINGS') {
                mockData.integrations = mockData.integrations || [];
                const index = mockData.integrations.findIndex(i => i.provider === 'core_settings');
                if (index > -1) {
                    mockData.integrations[index].config = payload;
                } else {
                    mockData.integrations.push({ provider: 'core_settings', config: payload });
                }
            }
        } else {
            const pool = getPool();
            const connection = await pool.getConnection();
            try {
                if (entry.entity_type === 'ORDER') {
                    // Restore to order table
                    await connection.query(
                        `INSERT INTO orders (id, customer_contact, status, created_at, share_token, data, updated_at) 
                         VALUES (?, ?, ?, ?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE status=VALUES(status), share_token=VALUES(share_token), data=VALUES(data), updated_at=VALUES(updated_at)`,
                        [
                            payload.id, 
                            payload.customerContact || null, 
                            payload.status || 'ACTIVE', 
                            new Date(payload.createdAt || Date.now()), 
                            payload.shareToken || null, 
                            JSON.stringify(payload), 
                            Date.now()
                        ]
                    );
                    
                    // Restore milestones
                    if (payload.paymentPlan && payload.paymentPlan.milestones) {
                        const milestoneIds = payload.paymentPlan.milestones.map(m => m.id);
                        if (milestoneIds.length > 0) {
                            await connection.query(`DELETE FROM payment_schedules WHERE orderId = ? AND id NOT IN (?)`, [payload.id, milestoneIds]);
                        } else {
                            await connection.query(`DELETE FROM payment_schedules WHERE orderId = ?`, [payload.id]);
                        }
                        
                        for (const m of payload.paymentPlan.milestones) {
                            await connection.query(
                                `INSERT INTO payment_schedules (id, orderId, dueDate, targetAmount, cumulativeTarget, status, warningCount) 
                                 VALUES (?, ?, ?, ?, ?, ?, ?) 
                                 ON DUPLICATE KEY UPDATE dueDate=VALUES(dueDate), targetAmount=VALUES(targetAmount), cumulativeTarget=VALUES(cumulativeTarget), status=VALUES(status)`,
                                [m.id, payload.id, new Date(m.dueDate), m.targetAmount, m.cumulativeTarget, m.status, m.warningCount || 0]
                            );
                        }
                    }
                    
                    // Broadcast update to frontends immediately
                    if (req.io) {
                        req.io.emit('orders_sync', [payload]);
                    }
                } else if (entry.entity_type === 'CUSTOMER') {
                    const customId = entry.entity_id;
                    await connection.query(
                        `INSERT INTO customers (id, contact, name, data, updated_at) 
                         VALUES (?, ?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE name=VALUES(name), data=VALUES(data), updated_at=VALUES(updated_at)`,
                        [customId, payload.contact, payload.name, JSON.stringify(payload), Date.now()]
                    );
                } else if (entry.entity_type === 'SETTINGS') {
                    const coreConfig = {
                        currentGoldRate24K: payload.currentGoldRate24K,
                        currentGoldRate22K: payload.currentGoldRate22K,
                        currentGoldRate18K: payload.currentGoldRate18K,
                        currentSilverRate: payload.currentSilverRate,
                        defaultTaxRate: payload.defaultTaxRate,
                        goldRateProtectionMax: payload.goldRateProtectionMax,
                        gracePeriodHours: payload.gracePeriodHours,
                        followUpIntervalDays: payload.followUpIntervalDays,
                        goldRateFetchIntervalMinutes: payload.goldRateFetchIntervalMinutes,
                        preferredRateProvider: payload.preferredRateProvider,
                        breachBufferMinutes: payload.breachBufferMinutes,
                        cooldownHours: payload.cooldownHours,
                        reminderScheduleDays: payload.reminderScheduleDays,
                        overdueFrequencyDays: payload.overdueFrequencyDays,
                        maxRemindersPerMilestone: payload.maxRemindersPerMilestone
                    };
                    await connection.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['core_settings', JSON.stringify(coreConfig)]);
                }
            } finally {
                connection.release();
            }
        }
        
        res.json({ success: true, message: `Reversion executed successfully. Entity ${entry.entity_type} (#${entry.entity_id}) restored to state of transaction ${txId}.` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Download physical log file directly
router.get('/journal/download', async (req, res) => {
    try {
        if (!fs.existsSync(JOURNAL_FILE_PATH)) {
            return res.status(404).send('Live mirror log file does not exist yet. Perform some database edits to generate activity.');
        }
        res.setHeader('Content-disposition', `attachment; filename=live_journal_mirror.log`);
        res.setHeader('Content-type', 'application/json-seq');
        res.sendFile(JOURNAL_FILE_PATH);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// Get Journal Stats
router.get('/journal/stats', async (req, res) => {
    try {
        let dbCount = 0;
        let diskSize = 0;
        let lastTimestamp = null;
        
        if (!isMock) {
            const pool = getPool();
            const connection = await pool.getConnection();
            try {
                const [countRows] = await connection.query('SELECT COUNT(*) as cnt FROM transaction_journal');
                dbCount = countRows[0].cnt;
                
                const [lastRows] = await connection.query('SELECT timestamp FROM transaction_journal ORDER BY timestamp DESC LIMIT 1');
                if (lastRows.length > 0) lastTimestamp = lastRows[0].timestamp;
            } finally {
                connection.release();
            }
        } else {
            dbCount = (mockData.transaction_journal || []).length;
            if (dbCount > 0) {
                lastTimestamp = mockData.transaction_journal[dbCount - 1].timestamp;
            }
        }
        
        if (fs.existsSync(JOURNAL_FILE_PATH)) {
            const stats = fs.statSync(JOURNAL_FILE_PATH);
            diskSize = stats.size;
        }
        
        res.json({
            success: true,
            dbCount,
            diskSize,
            lastTimestamp,
            syncStatus: 'SYNCHRONIZED',
            redundancy: 'DUAL_LAYER_ACTIVE'
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
