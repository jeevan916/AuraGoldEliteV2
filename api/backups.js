import express from 'express';
import fs from 'fs';
import path from 'path';
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

export default router;
