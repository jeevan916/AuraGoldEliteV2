
import { getPool } from './db.js';
import https from 'https';
import http from 'http';

let backgroundInterval = null;
let currentIntervalMins = null;
let io = null;

export const setRateServiceIo = (socketIo) => {
    io = socketIo;
};

// Helper for robust fetching from legacy servers (ignores SSL errors, follows redirects)
const fetchInsecure = (url, depth = 0) => {
    if (depth > 5) return Promise.reject(new Error("Too many redirects"));

    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https');
        const lib = isHttps ? https : http;
        
        const request = lib.get(url, {
            rejectUnauthorized: false, // Bypass SSL for legacy servers
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
            },
            timeout: 20000 // 20s timeout
        }, (res) => {
            // Handle Redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const newUrl = new URL(res.headers.location, url).href;
                res.resume();
                fetchInsecure(newUrl, depth + 1).then(resolve).catch(reject);
                return;
            }

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });
        });

        request.on('error', (err) => reject(err));
        request.on('timeout', () => {
            request.destroy();
            reject(new Error("Request Timeout (20s)"));
        });
    });
};

/**
 * Fetches gold rate from external API and saves to database.
 * Source: Sagar Jewellers (VOTS Broadcast)
 */
export async function fetchAndSaveRate() {
    console.log(`[RateService] Executing scheduled fetch: ${new Date().toISOString()}`);
    try {
        const timestamp = Date.now();
        const apiUrl = `https://bcast.sagarjewellers.co.in:7768/VOTSBroadcastStreaming/Services/xml/GetLiveRateByTemplateID/sagar?_=${timestamp}`;
        
        const rawText = await fetchInsecure(apiUrl);
        
        // Parse Lines
        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const snippet = lines.slice(0, 15).join('\n'); 

        let matchDebug = "No match found";
        let rate24k = 0;
        let rateSilver = 0;

        // --- Extraction Helper ---
        const extractMax = (line) => {
            if (!line) return 0;
            // Capture numbers > 1000 to avoid IDs
            const nums = line.match(/(\d{4,}(\.\d+)?)/g);
            if (!nums || nums.length === 0) return 0;
            
            const prices = nums.map(n => parseFloat(n)).filter(n => n > 1000); 
            if (prices.length === 0) return 0;
            
            // Take the max value (usually Ask price)
            return Math.max(...prices);
        };

        // 1. Extract Gold Rate (Priority: 99.5 RTGS)
        const goldLine = lines.find(l => /GOLD\s*NAGPUR.*99\.?5.*RTGS/i.test(l)) 
                      || lines.find(l => /GOLD\s*NAGPUR.*99\.?9/i.test(l));
        
        if (goldLine) {
            rate24k = extractMax(goldLine);
            matchDebug = `Gold Line: ${goldLine} | Raw: ${rate24k}`;
        }

        // 2. Extract Silver Rate
        const silverLine = lines.find(l => /SILVER\s*NAGPUR.*RTGS/i.test(l));
        if (silverLine) {
            rateSilver = extractMax(silverLine);
            matchDebug += ` || Silver Line: ${silverLine} | Raw: ${rateSilver}`;
        }

        // 3. Normalization
        // User confirmed: Raw value (e.g., 151314) is for 10 grams.
        if (rate24k > 10000) {
            rate24k = rate24k / 10; // Convert 10g -> 1g
            matchDebug += " (Normalized /10)";
        }

        // Silver Normalization
        // If > 10,000, assume it's 1kg and convert to 1g
        if (rateSilver > 10000) {
            rateSilver = rateSilver / 1000;
            matchDebug += " (Silver Normalized /1000)";
        }

        // 4. Validation
        if (!rate24k || rate24k <= 0) {
            console.warn(`[RateService] Failed to parse. Dump: \n${snippet}`);
            throw new Error(`Parsed gold rate is invalid. Debug: ${matchDebug}`);
        }

        // 5. Calculate Derived Rates (Rounded)
        rate24k = Math.round(rate24k);
        rateSilver = Math.round(rateSilver || 90); 
        const rate22k = Math.round(rate24k * 0.916);
        const rate18k = Math.round(rate24k * 0.75);

        // 6. Database Save
        const pool = getPool();
        if (!pool) return { success: false, error: "Database not ready" };
        
        const connection = await pool.getConnection();
        
        await connection.query(
            'INSERT INTO gold_rates (rate24k, rate22k, rate18k, rateSilver) VALUES (?, ?, ?, ?)', 
            [rate24k, rate22k, rate18k, rateSilver]
        );
        
        // Update Core Settings Cache
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = 'core_settings'");
        if (rows.length > 0) {
            const config = JSON.parse(rows[0].config);
            config.currentGoldRate24K = rate24k;
            config.currentGoldRate22K = rate22k;
            config.currentGoldRate18K = rate18k;
            config.currentSilverRate = rateSilver;
            await connection.query("UPDATE integrations SET config = ? WHERE provider = 'core_settings'", [JSON.stringify(config)]);
        }

        connection.release();
        
        const payload = { 
            rate24k, rate22k, rate18k, rateSilver, 
            timestamp: new Date().toISOString(),
            rawSnippet: snippet,
            matchDebug: matchDebug
        };
        
        console.log(`[RateService] Success: 1g 24K=₹${rate24k}, 1g Silver=₹${rateSilver}`);
        
        if (io) {
            io.emit('rate_update', payload);
        }

        return { success: true, ...payload };
    } catch (e) {
        console.error("[RateService] Automatic fetch failed:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * Initializes the background fetching loop.
 */
export async function initRateService() {
    try {
        const pool = getPool();
        if (!pool) return setTimeout(initRateService, 5000); // Wait for DB

        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = 'core_settings'");
        connection.release();

        let interval = 60; // Default
        if (rows.length > 0) {
            const config = JSON.parse(rows[0].config);
            interval = config.goldRateFetchIntervalMinutes || 60;
        }

        startLoop(interval);
    } catch (e) {
        console.error("[RateService] Initialization error:", e.message);
    }
}

function startLoop(mins) {
    if (backgroundInterval) clearInterval(backgroundInterval);
    currentIntervalMins = mins;
    
    // Immediate first fetch
    fetchAndSaveRate();

    backgroundInterval = setInterval(() => {
        fetchAndSaveRate();
    }, mins * 60 * 1000);
    
    console.log(`[RateService] Background task started. Fetch interval: ${mins} minutes.`);
}

/**
 * Updates the fetching interval if changed in settings.
 */
export function refreshInterval(newMins) {
    if (newMins === currentIntervalMins) return;
    console.log(`[RateService] Refreshing interval to ${newMins} mins`);
    startLoop(newMins);
}
