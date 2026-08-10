import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPool, isMock } from './db.js';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const ORDERED_DIR = path.join(UPLOADS_DIR, 'ordered');
const READY_DIR = path.join(UPLOADS_DIR, 'ready');

// Ensure the uploads directory and subdirectories exist on the server drive
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(ORDERED_DIR)) fs.mkdirSync(ORDERED_DIR, { recursive: true });
if (!fs.existsSync(READY_DIR)) fs.mkdirSync(READY_DIR, { recursive: true });

/**
 * Saves a base64 encoded data-url image to the physical server drive
 * inside either the 'ordered' or 'ready' folder and returns the relative path URL.
 * 
 * @param {string} base64Str - The data URL (e.g. data:image/jpeg;base64,...)
 * @param {string} folder - 'ordered' or 'ready'
 * @returns {string} - The public relative path (e.g. /uploads/ordered/filename.jpg)
 */
export function saveBase64ImageToServer(base64Str, folder = 'ordered') {
    if (!base64Str || typeof base64Str !== 'string') return base64Str;
    if (!base64Str.startsWith('data:image/')) return base64Str;

    try {
        const match = base64Str.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (!match) return base64Str;

        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const data = match[2];
        const buffer = Buffer.from(data, 'base64');

        const targetFolder = folder === 'ready' ? READY_DIR : ORDERED_DIR;
        const subPath = folder === 'ready' ? 'ready' : 'ordered';

        // Generate a cryptographically secure safe unique filename
        const filename = `img_${crypto.randomBytes(8).toString('hex')}_${Date.now()}.${ext}`;
        const filePath = path.join(targetFolder, filename);

        // Save the file binary to server drive
        fs.writeFileSync(filePath, buffer);
        console.log(`[Storage Service] Saved base64 image physically at /uploads/${subPath}/${filename} (${Math.round(buffer.length / 1024)} KB)`);

        return `/uploads/${subPath}/${filename}`;
    } catch (err) {
        console.error("[Storage Service] Error saving base64 image:", err.message);
        return base64Str; // Return original on failure
    }
}

/**
 * Processes an order object, transferring any base64 images to physical storage in /uploads/ordered or /uploads/ready.
 * 
 * @param {object} order - The order payload from the client
 * @returns {object} - The mutated order with relative file URLs
 */
export function processOrderImages(order) {
    if (!order || !order.items || !Array.isArray(order.items)) return order;

    for (const item of order.items) {
        if (item.photoUrls && Array.isArray(item.photoUrls)) {
            item.photoUrls = item.photoUrls.map(url => saveBase64ImageToServer(url, 'ordered'));
        }
        if (item.readyPhotoUrls && Array.isArray(item.readyPhotoUrls)) {
            item.readyPhotoUrls = item.readyPhotoUrls.map(url => saveBase64ImageToServer(url, 'ready'));
        }
    }
    return order;
}

/**
 * One-time startup migration: Scans the relational DB orders for old embedded base64 blobs,
 * extracts them, writes them to files in /uploads/ordered or /uploads/ready, and updates the database record with relative URLs.
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

    console.log("[Migration] Running analysis for base64 embedded images in active records...");

    let connection;
    try {
        connection = await pool.getConnection();

        // Find orders containing base64 images
        const [orders] = await connection.query("SELECT id, data FROM orders WHERE data LIKE '%data:image/%'");
        if (orders.length === 0) {
            console.log("[Migration] Analysis complete: No base64 images found in active orders.");
            connection.release();
            return;
        }

        console.log(`[Migration] Analysis complete: Found ${orders.length} orders containing embedded base64 images. Initiating transfer...`);

        let migratedCount = 0;

        for (const orderRow of orders) {
            try {
                const order = JSON.parse(orderRow.data);
                let orderModified = false;

                if (order.items && Array.isArray(order.items)) {
                    for (const item of order.items) {
                        // Extract photoUrls (Ordered Reference images)
                        if (item.photoUrls && Array.isArray(item.photoUrls)) {
                            item.photoUrls = item.photoUrls.map(url => {
                                if (url && url.startsWith('data:image/')) {
                                    const match = url.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
                                    if (match) {
                                        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
                                        const data = match[2];
                                        const buffer = Buffer.from(data, 'base64');
                                        const filename = `migrated_${crypto.randomBytes(8).toString('hex')}_${Date.now()}.${ext}`;
                                        const filePath = path.join(ORDERED_DIR, filename);

                                        fs.writeFileSync(filePath, buffer);
                                        orderModified = true;
                                        migratedCount++;
                                        return `/uploads/ordered/${filename}`;
                                    }
                                }
                                return url;
                            });
                        }

                        // Extract readyPhotoUrls (Showcase / Final pictures)
                        if (item.readyPhotoUrls && Array.isArray(item.readyPhotoUrls)) {
                            item.readyPhotoUrls = item.readyPhotoUrls.map(url => {
                                if (url && url.startsWith('data:image/')) {
                                    const match = url.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
                                    if (match) {
                                        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
                                        const data = match[2];
                                        const buffer = Buffer.from(data, 'base64');
                                        const filename = `migrated_${crypto.randomBytes(8).toString('hex')}_${Date.now()}.${ext}`;
                                        const filePath = path.join(READY_DIR, filename);

                                        fs.writeFileSync(filePath, buffer);
                                        orderModified = true;
                                        migratedCount++;
                                        return `/uploads/ready/${filename}`;
                                    }
                                }
                                return url;
                            });
                        }
                    }
                }

                if (orderModified) {
                    await connection.query("UPDATE orders SET data = ? WHERE id = ?", [JSON.stringify(order), orderRow.id]);
                    console.log(`[Migration] Successfully extracted and saved images for Order #${orderRow.id}`);
                }
            } catch (orderErr) {
                console.error(`[Migration] Failed to migrate row #${orderRow.id}:`, orderErr.message);
            }
        }

        console.log(`[Migration] Migration complete. Transferred ${migratedCount} base64 images successfully onto the server's drive.`);
    } catch (err) {
        console.error("[Migration] Error during image migration script execution:", err.message);
    } finally {
        if (connection) connection.release();
    }
}
