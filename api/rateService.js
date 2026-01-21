
import { getPool } from './db.js';

let backgroundInterval = null;
let currentIntervalMins = null;
let io = null;

export const setRateServiceIo = (socketIo) => {
    io = socketIo;
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
        
        // Fetch with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const externalRes = await fetch(apiUrl, {
            method: 'GET',
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Node.js)',
                'Accept': 'text/xml, application/xml, text/plain' 
            },
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!externalRes.ok) throw new Error(`External API Error: ${externalRes.status}`);
        
        const xmlText = await externalRes.text();
        
        // --- PARSING LOGIC ---
        // Prioritizes BID/BUY/LIVE rate.
        const extractRate = (symbolRegexStr) => {
            // 1. Try to find Bid/Buy specific tags first
            const bidRegex = new RegExp(`(?:<Symbol>|<Product>)\\s*(${symbolRegexStr})[\\s\\S]*?(?:<Bid>|<Buy>|<Rate>)\\s*([0-9.,]+)\\s*(?:<\\/Bid>|<\\/Buy>|<\\/Rate>)`, 'i');
            const match = xmlText.match(bidRegex);
            
            if (match) {
                return parseFloat(match[2].replace(/,/g, ''));
            }

            // 2. Fallback to Ask/Sell if Bid is completely missing/empty, though user prefers Buy
            const fallbackRegex = new RegExp(`(?:<Symbol>|<Product>)\\s*(${symbolRegexStr})[\\s\\S]*?(?:<Ask>|<Sell>)\\s*([0-9.,]+)\\s*(?:<\\/Ask>|<\\/Sell>)`, 'i');
            const fallbackMatch = xmlText.match(fallbackRegex);
            if (fallbackMatch) {
                return parseFloat(fallbackMatch[2].replace(/,/g, ''));
            }
            
            return 0;
        };

        // 1. Gold Rate (Target: GOLD NAGPUR 99.9 RTGS)
        let rate24k = extractRate('GOLD.*99\\.?9'); 
        if (!rate24k) rate24k = extractRate('GOLD.*99\\.?5');
        if (!rate24k) rate24k = extractRate('GOLD');

        // 2. Silver Rate (Target: SILVER NAGPUR RTGS)
        let rateSilver = extractRate('SILVER.*RTGS');
        if (!rateSilver) rateSilver = extractRate('SILVER');

        // 3. Normalization Logic
        
        // GOLD: User confirmed 153611 is the rate for 10gm.
        // We calculate per gram by dividing by 10.
        if (rate24k > 10000) {
            rate24k = rate24k / 10; 
        }
        
        // SILVER: Handle 1kg unit (Standard convention)
        if (rateSilver > 1000) {
            rateSilver = rateSilver / 1000;
        }

        if (!rate24k || rate24k <= 0) {
            if (xmlText.length < 500) console.warn("Invalid XML Response snippet:", xmlText);
            throw new Error("Parsed gold rate is invalid or zero");
        }

        rate24k = Math.round(rate24k);
        rateSilver = Math.round(rateSilver || 90); 

        const rate22k = Math.round(rate24k * 0.916);
        const rate18k = Math.round(rate24k * 0.75);

        const pool = getPool();
        if (!pool) return { success: false, error: "Database not ready" };
        
        const connection = await pool.getConnection();
        
        // Log to DB
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
            timestamp: new Date().toISOString() 
        };
        
        console.log(`[RateService] Rates updated: 24K=₹${rate24k}/g, Silver=₹${rateSilver}/g`);
        
        // Emit real-time update
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
