import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPool, isMock } from './db.js';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const SUBFOLDERS = ['ordered', 'ready', 'catalog', 'estimates', 'customers', 'general'];

// Ensure all upload directories and subdirectories exist on the server drive
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
for (const sub of SUBFOLDERS) {
    const subDir = path.join(UPLOADS_DIR, sub);
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
}

/**
 * Saves a base64 encoded data-url image to the physical server drive
 * inside the designated folder and returns the relative path URL.
 * 
 * @param {string} base64Str - The data URL (e.g. data:image/jpeg;base64,...)
 * @param {string} folder - 'ordered' | 'ready' | 'catalog' | 'estimates' | 'customers' | 'general'
 * @returns {string} - The public relative path (e.g. /uploads/ordered/filename.jpg)
 */
export function saveBase64ImageToServer(base64Str, folder = 'ordered') {
    if (!base64Str || typeof base64Str !== 'string') return base64Str;
    if (!base64Str.startsWith('data:image/')) return base64Str;

    try {
        const match = base64Str.match(/^data:image\/([a-zA-Z0-9\+\-]+);base64,(.+)$/);
        if (!match) return base64Str;

        let rawExt = match[1].toLowerCase();
        if (rawExt === 'jpeg') rawExt = 'jpg';
        else if (rawExt === 'svg+xml') rawExt = 'svg';
        const ext = rawExt.replace(/[^a-z0-9]/g, '') || 'jpg';

        const data = match[2];
        const buffer = Buffer.from(data, 'base64');

        const validFolder = SUBFOLDERS.includes(folder) ? folder : 'general';
        const targetFolder = path.join(UPLOADS_DIR, validFolder);
        if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

        // Generate a cryptographically safe unique filename
        const filename = `img_${crypto.randomBytes(8).toString('hex')}_${Date.now()}.${ext}`;
        const filePath = path.join(targetFolder, filename);

        // Save the file binary to server drive
        fs.writeFileSync(filePath, buffer);
        console.log(`[Storage Service] Saved image physically to /uploads/${validFolder}/${filename} (${Math.round(buffer.length / 1024)} KB)`);

        return `/uploads/${validFolder}/${filename}`;
    } catch (err) {
        console.error("[Storage Service] Error saving base64 image:", err.message);
        return base64Str; // Return original on failure
    }
}

/**
 * Recursively inspects any object, array, or string, extracting any embedded base64 images,
 * saving them to physical disk files, and replacing them with relative /uploads/... URLs.
 * 
 * @param {any} target - The object, array, or string to sanitize
 * @param {string} defaultFolder - The default storage folder
 * @returns {any} - The sanitized data structure
 */
export function stripAndSaveBase64Images(target, defaultFolder = 'ordered') {
    if (!target) return target;

    if (typeof target === 'string') {
        if (target.startsWith('data:image/')) {
            return saveBase64ImageToServer(target, defaultFolder);
        }
        return target;
    }

    if (Array.isArray(target)) {
        return target.map(item => stripAndSaveBase64Images(item, defaultFolder));
    }

    if (typeof target === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(target)) {
            let folderForField = defaultFolder;
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('ready') || lowerKey === 'readyphotourls') {
                folderForField = 'ready';
            } else if (lowerKey.includes('catalog') || lowerKey.includes('product')) {
                folderForField = 'catalog';
            } else if (lowerKey.includes('estimate') || lowerKey.includes('cart')) {
                folderForField = 'estimates';
            } else if (lowerKey.includes('customer') || lowerKey.includes('avatar') || lowerKey.includes('profile')) {
                folderForField = 'customers';
            } else if (lowerKey.includes('photo') || lowerKey.includes('image') || lowerKey.includes('design')) {
                folderForField = defaultFolder === 'ready' ? 'ready' : 'ordered';
            }

            cleaned[key] = stripAndSaveBase64Images(value, folderForField);
        }
        return cleaned;
    }

    return target;
}

/**
 * Processes an order object, transferring any base64 images to physical storage in /uploads/ordered or /uploads/ready.
 * 
 * @param {object} order - The order payload from the client
 * @returns {object} - The mutated order with relative file URLs
 */
export function processOrderImages(order) {
    if (!order) return order;
    return stripAndSaveBase64Images(order, 'ordered');
}

/**
 * Startup migration: Scans relational DB tables (orders, catalog, salesman_estimates, customers, templates, external_payments)
 * for old embedded base64 blobs, writes them to physical files in /uploads/..., and updates database records with relative URLs.
 */
export async function migrateExistingDbImages() {
    if (isMock) {
        console.log("[Migration] Mock DB active. Skipping image extraction.");
        return;
    }

    const pool = getPool();
    if (!pool) {
        console.warn("[Migration] Pool is unavailable. Skipping startup image migration.");
        return;
    }

    console.log("[Migration] Running analysis for base64 embedded images across all database tables...");

    let connection;
    try {
        connection = await pool.getConnection();

        const tablesToScan = [
            { name: 'orders', idCol: 'id', dataCol: 'data', defaultFolder: 'ordered' },
            { name: 'catalog', idCol: 'id', dataCol: 'data', defaultFolder: 'catalog' },
            { name: 'salesman_estimates', idCol: 'id', dataCol: 'data', defaultFolder: 'estimates' },
            { name: 'customers', idCol: 'id', dataCol: 'data', defaultFolder: 'customers' },
            { name: 'templates', idCol: 'id', dataCol: 'data', defaultFolder: 'general' },
            { name: 'external_payments', idCol: 'id', dataCol: 'data', defaultFolder: 'general' }
        ];

        let totalMigratedImages = 0;

        for (const tbl of tablesToScan) {
            try {
                // Check if table exists
                const [rows] = await connection.query(
                    `SELECT ${tbl.idCol} AS id, ${tbl.dataCol} AS data FROM ${tbl.name} WHERE ${tbl.dataCol} LIKE '%data:image/%'`
                );

                if (rows.length > 0) {
                    console.log(`[Migration] Found ${rows.length} rows with base64 images in table '${tbl.name}'. Extracting to drive...`);
                    for (const row of rows) {
                        try {
                            const parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
                            const cleanedData = stripAndSaveBase64Images(parsedData, tbl.defaultFolder);
                            const updatedJson = JSON.stringify(cleanedData);

                            await connection.query(
                                `UPDATE ${tbl.name} SET ${tbl.dataCol} = ? WHERE ${tbl.idCol} = ?`,
                                [updatedJson, row.id]
                            );
                            totalMigratedImages++;
                        } catch (rowErr) {
                            console.warn(`[Migration] Error processing row ${row.id} in ${tbl.name}:`, rowErr.message);
                        }
                    }
                    console.log(`[Migration] Cleaned and updated ${rows.length} rows in '${tbl.name}'.`);
                }
            } catch (tblErr) {
                // Table might not exist yet or have no records; non-fatal
            }
        }

        if (totalMigratedImages === 0) {
            console.log("[Migration] Analysis complete: No legacy base64 images found across database tables.");
        } else {
            console.log(`[Migration] Database migration complete: Successfully extracted and cleared base64 images from ${totalMigratedImages} database records.`);
        }
    } catch (err) {
        console.error("[Migration] Error during image migration execution:", err.message);
    } finally {
        if (connection) {
            try { connection.release(); } catch (e) {}
        }
    }
}
