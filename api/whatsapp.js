
import express from 'express';
import fs from 'fs';
import path from 'path';
import { getPool, ensureDb, normalizePhone, logDbActivity } from './db.js';
import { checkRateBreaches } from './rateService.js';
import { runPaymentReminders } from './reminderService.js';

const router = express.Router();
const META_API_VERSION = "v20.0";
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export function enrichLogMedia(log) {
    if (!log) return log;
    if (log.mediaUrl) return log;

    const raw = log.rawResponse || log.raw || {};
    let mId = log.mediaId || null;
    let mType = log.mediaType || null;
    let mCaption = log.mediaCaption || null;

    if (!mId) {
        if (raw.image?.id) {
            mId = raw.image.id;
            mType = 'image';
            mCaption = raw.image?.caption || null;
        } else if (raw.document?.id) {
            mId = raw.document.id;
            mType = 'document';
            mCaption = raw.document?.caption || raw.document?.filename || null;
        } else if (raw.video?.id) {
            mId = raw.video.id;
            mType = 'video';
            mCaption = raw.video?.caption || null;
        } else if (raw.sticker?.id) {
            mId = raw.sticker.id;
            mType = 'sticker';
        } else if (raw.audio?.id) {
            mId = raw.audio.id;
            mType = 'audio';
        }
    }

    if (mId) {
        log.mediaId = mId;
        log.mediaType = mType || 'image';
        log.mediaUrl = `/api/whatsapp/media/${mId}`;
        if (mCaption) log.mediaCaption = mCaption;
    }

    return log;
}

const SYSTEM_TEMPLATES = {
  auragold_order_agreement: "Dear {{1}}, thank you for choosing AuraGold. We are pleased to share the details and payment schedule for your order of {{2}}.\n\nTotal Order Value: ₹{{3}} (rate protection limited)\nPayment Terms: {{4}}\n\nPayment Schedule:\n{{5}}\n\nYou can view the detailed breakdown and track your order progress here: https://order.auragoldelite.com/?token={{6}}\n\n!!!Pay your payments ON Time to prevent Gold Rate Protection Lapses!!!",
  auragold_weight_update: "Important update for {{1}}: We would like to inform you that the actual production weight for your {{2}} has been finalized. The final weight is {{3}}g, compared to the initial estimated weight of {{4}}g. This results in a net value change of ₹{{5}}. We have updated your final invoice accordingly to reflect this adjustment.",
  auragold_order_revised: "Dear {{1}}, we are writing to inform you that your Order {{2}} has been successfully revised in our system. The new total amount for your order is now ₹{{3}}. This adjustment was made due to the following reason: {{4}}. You can view your updated order details and track its progress securely by clicking here: https://order.auragoldelite.com/?token={{5}}",
  auragold_payment_receipt_store: "Hello {{1}}, this is an official receipt from AuraGold. We acknowledge receiving a payment of ₹{{2}} via {{3}} towards your Order ID {{4}}. Thank you for visiting our store. Your remaining outstanding balance is ₹{{5}}.",
  auragold_production_update: "Hello {{1}}, we have an update regarding your item {{2}} under Order ID {{3}}. The production status has now moved to the {{4}} stage. You can view the detailed progress tracking here: https://order.auragoldelite.com/?token={{5}}",
  auragold_payment_success_remote: "Dear {{1}}, your secure payment has been successfully confirmed. We have received ₹{{2}} via {{3}} for your Order ID {{4}}. Your ledger has been updated. The new remaining balance is ₹{{5}}.",
  auragold_rate_adjustment_alert: "Important notice for {{1}}: We are writing to inform you that the current market gold rate has unfortunately exceeded your agreed protection limit. As a result, a necessary adjustment surcharge of ₹{{2}} has been applied to your Order {{3}}. The new base rate for your order is now ₹{{4}}/g. You can review these changes and your updated order details securely here: https://order.auragoldelite.com/?token={{5}}",
  auragold_setu_payment: "Dear {{1}}, please pay ₹{{2}} securely using the UPI button below.",
  auragold_finished_item_showcase: "Great news, {{1}}! Your custom jewelry piece is finally ready. We are excited to share the finished look for your Order {{2}}. The item has passed our quality checks and we are now ready for the final handover. Please review the details.",
  auragold_gentle_reminder: "Hello {{1}}, a gentle reminder that your installment of {{2}} for order {{3}} is due. Please pay here: {{4}} to avoid delays.",
  auragold_payment_overdue: "Dear {{1}}, we noticed your payment of {{2}} is overdue. To maintain your gold rate protection, please clear the dues via: {{3}} today.",
  auragold_payment_overdue_alert: "Dear {{1}}, your payment of {{2}} for Order {{3}} is overdue. Please clear your dues immediately to maintain your gold rate protection.",
  auragold_urgent_lapse: "URGENT {{1}}: Your Gold Rate Protection for order {{2}} expires in 24 hours. Pay {{3}} immediately to save your booked rate: {{4}}",
  auragold_rate_adjustment_liability: "URGENT notice for {{1}}: Due to a missed payment milestone, your rate protection for Order {{3}} has lapsed. A market adjustment surcharge of ₹{{2}} has been applied. The new base rate is now ₹{{4}}/g. Please review and accept the new terms here: https://order.auragoldelite.com/?token={{5}}",
  auragold_external_payment_request: "Dear {{1}}, a payment request of ₹{{2}} has been created for Your order No {{3}} at Sanghavi Jewellers. You can pay securely in full or in flexible part payments via UPI."
};

function compileTemplateMessage(templateName, components) {
    const content = SYSTEM_TEMPLATES[templateName];
    if (!content) return `[Template: ${templateName}]`;

    let compiled = content;
    
    // Find body parameters
    const bodyComponent = (components || []).find(c => c.type === 'body' || c.type === 'BODY');
    if (bodyComponent && bodyComponent.parameters) {
        bodyComponent.parameters.forEach((param, idx) => {
            const val = param.text || '';
            compiled = compiled.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), val);
        });
    }

    // Find button parameters or URL parameters
    const buttonComponent = (components || []).find(c => c.type === 'button' || c.type === 'BUTTON');
    if (buttonComponent && buttonComponent.parameters) {
        buttonComponent.parameters.forEach((param) => {
            const val = param.text || '';
            compiled += `\n\nLink: ${val}`;
        });
    }

    return compiled;
}

export async function sendWhatsAppMessage({ to, message, templateName, language, components, customerName, phoneId, token, sentBy = 'SYSTEM', metadata = {}, orderId }) {
    if (!phoneId || !token) {
        throw new Error("Missing WhatsApp Credentials");
    }

    // Check if WhatsApp messages are globally enabled/disabled in settings
    let whatsappEnabled = true;
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['core_settings']);
        connection.release();
        if (rows.length > 0) {
            const config = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
            if (config && config.whatsappEnabled !== undefined) {
                whatsappEnabled = !!config.whatsappEnabled;
            }
        }
    } catch (e) {
        console.error("[WhatsApp Guard] Failed to read whatsappEnabled from core_settings, defaulting to true:", e);
    }

    if (!whatsappEnabled) {
        console.log(`[WhatsApp Guard] Bypassing message send because WhatsApp messaging is globally turned OFF in settings. Recipient: ${to}, Template: ${templateName || 'None'}`);
        return { 
            success: true, 
            bypassed: true, 
            message: "WhatsApp messaging is globally turned OFF in settings.",
            data: { messages: [{ id: "bypassed_due_to_settings_off_" + Date.now() }] }
        };
    }

    let payload = { 
        messaging_product: "whatsapp", 
        recipient_type: "individual",
        to: normalizePhone(to) 
    };

    if (templateName) {
        payload.type = "template";
        payload.template = { 
            name: templateName, 
            language: { code: language || "en_US" }, 
            components: components || []
        };
    } else {
        payload.type = "text";
        payload.text = { body: message };
    }
    
    // Log the Trigger Event
    const actionDesc = templateName ? `Sent Template: ${templateName}` : 'Sent Manual Message';
    // Note: logDbActivity needs a req object, which we don't have here. 
    // We might need to adjust logDbActivity or handle logging differently.
    // For now, let's skip logDbActivity or create a simpler version.
    
    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        
        if (!r.ok || data.error) {
             console.error("Meta Send Error:", JSON.stringify(data.error));
             const pool = getPool();
             const connection = await pool.getConnection();
             const compiledMsg = templateName ? compileTemplateMessage(templateName, components) : message;
             const failedId = "failed_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
             const failedLog = { 
                 id: failedId, 
                 customerName: customerName || "Customer", 
                 phoneNumber: normalizePhone(to), 
                 message: compiledMsg || message || "Failed Message", 
                 status: 'FAILED', 
                 timestamp: new Date().toISOString(), 
                 direction: 'outbound', 
                 type: templateName ? 'TEMPLATE' : 'CUSTOM', 
                 sentBy, 
                 orderId, 
                 templateName, 
                 components,
                 metaError: data.error || data,
                 rawResponse: data,
                 ...metadata 
             };
             await connection.query('INSERT INTO whatsapp_logs (id, phone, order_id, direction, timestamp, data) VALUES (?, ?, ?, ?, ?, ?)', [failedLog.id, failedLog.phoneNumber, orderId || null, 'outbound', new Date(), JSON.stringify(failedLog)]);
             connection.release();

             const err = new Error(data.error?.message || "Meta API Error");
             err.raw = data;
             err.logEntry = failedLog;
             throw err;
        }

        let returnLog = null;
        if (data.messages) {
            const pool = getPool();
            const connection = await pool.getConnection();
            const compiledMsg = templateName ? compileTemplateMessage(templateName, components) : message;
            const log = { id: data.messages[0].id, customerName: customerName || "Customer", phoneNumber: normalizePhone(to), message: compiledMsg, status: 'SENT', timestamp: new Date().toISOString(), direction: 'outbound', type: templateName ? 'TEMPLATE' : 'CUSTOM', sentBy, orderId, templateName, components, ...metadata };
            await connection.query('INSERT INTO whatsapp_logs (id, phone, order_id, direction, timestamp, data) VALUES (?, ?, ?, ?, ?, ?)', [log.id, log.phoneNumber, orderId || null, 'outbound', new Date(), JSON.stringify(log)]);
            // Note: io is not available here.
            connection.release();
            returnLog = log;
        }
        return { success: true, data, logEntry: returnLog };
    } catch (e) { 
        console.error("WhatsApp Send Error:", e);
        throw e;
    }
}

// Webhook Verification
router.get('/webhook', async (req, res) => {
    let verify_token = process.env.WHATSAPP_VERIFY_TOKEN || "";
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['whatsapp']);
        connection.release();
        if (rows.length > 0) {
            const config = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
            if (config && config.verifyToken) {
                verify_token = config.verifyToken;
            }
        }
    } catch (e) {
        console.error("Failed to fetch WhatsApp verify_token from DB, using fallback", e);
    }

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) return res.status(200).send(challenge);
        return res.sendStatus(403);
    }
    res.sendStatus(400);
});

// Inbound Webhook
router.post('/webhook', ensureDb, async (req, res) => {
    res.status(200).send('EVENT_RECEIVED');
    try {
        const body = req.body;
        if (!body.entry || !body.entry[0].changes) return;
        const change = body.entry[0].changes[0].value;
        const pool = getPool();
        const connection = await pool.getConnection();

        if (change.messages && change.messages[0]) {
            const msg = change.messages[0];
            const fromFormatted = normalizePhone(msg.from);

            let mediaId = null;
            let mediaType = msg.type || 'text';
            let mediaCaption = null;
            let mimeType = null;

            if (msg.image) {
                mediaId = msg.image.id;
                mediaCaption = msg.image.caption || null;
                mimeType = msg.image.mime_type || 'image/jpeg';
            } else if (msg.document) {
                mediaId = msg.document.id;
                mediaCaption = msg.document.caption || msg.document.filename || null;
                mimeType = msg.document.mime_type || 'application/pdf';
            } else if (msg.video) {
                mediaId = msg.video.id;
                mediaCaption = msg.video.caption || null;
                mimeType = msg.video.mime_type || 'video/mp4';
            } else if (msg.audio) {
                mediaId = msg.audio.id;
                mimeType = msg.audio.mime_type || 'audio/ogg';
            } else if (msg.sticker) {
                mediaId = msg.sticker.id;
                mimeType = msg.sticker.mime_type || 'image/webp';
            }

            const mediaUrl = mediaId ? `/api/whatsapp/media/${mediaId}` : null;
            const msgBody = msg.text?.body || mediaCaption || (mediaType === 'image' ? '[Media: image]' : `[Media: ${mediaType}]`);

            const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
            let contactName = change.contacts?.[0]?.profile?.name || "Customer";
            if (contactName.toLowerCase() === 'empty') {
                contactName = "Customer";
            }
            
            // Link to latest order if any
            const [ordersRows] = await connection.query("SELECT data FROM orders");
            const customerOrders = ordersRows.map(r => JSON.parse(r.data)).filter(o => normalizePhone(o.customerContact) === fromFormatted);
            let mostRecentOrderId = null;
            if (customerOrders.length > 0) {
                customerOrders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                mostRecentOrderId = customerOrders[0].id;
                if (customerOrders[0].customerName) {
                    contactName = customerOrders[0].customerName;
                }
            } else {
                // If no orders matched, query the customers table
                try {
                    const [custRows] = await connection.query("SELECT name FROM customers WHERE contact = ?", [msg.from]);
                    if (custRows.length > 0 && custRows[0].name && custRows[0].name !== 'Unknown') {
                        contactName = custRows[0].name;
                    } else {
                        const [custRows2] = await connection.query("SELECT name FROM customers WHERE contact LIKE ?", [`%${fromFormatted.slice(-10)}%`]);
                        if (custRows2.length > 0 && custRows2[0].name && custRows2[0].name !== 'Unknown') {
                            contactName = custRows2[0].name;
                        }
                    }
                } catch (lookupErr) {
                    console.error("[Webhook] Customer lookup error:", lookupErr);
                }
            }

            const logEntry = { 
                id: msg.id, 
                customerName: contactName, 
                phoneNumber: fromFormatted, 
                message: msgBody, 
                status: 'READ', 
                timestamp, 
                direction: 'inbound', 
                type: 'INBOUND', 
                orderId: mostRecentOrderId,
                mediaId,
                mediaType,
                mediaUrl,
                mediaCaption,
                mimeType,
                rawResponse: msg
            };
            
            await connection.query(`INSERT INTO whatsapp_logs (id, phone, order_id, direction, timestamp, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data), order_id=VALUES(order_id)`, [logEntry.id, fromFormatted, mostRecentOrderId, 'inbound', new Date(timestamp), JSON.stringify(logEntry)]);
            
            if (req.io) req.io.emit('whatsapp_update', logEntry);
        }

        if (change.statuses && change.statuses[0]) {
            const statusUpdate = change.statuses[0];
            const [rows] = await connection.query('SELECT data FROM whatsapp_logs WHERE id = ?', [statusUpdate.id]);
            if (rows.length > 0) {
                let data = JSON.parse(rows[0].data);
                data.status = statusUpdate.status.toUpperCase();
                if (statusUpdate.errors) {
                    data.metaError = statusUpdate.errors;
                }
                data.rawResponse = statusUpdate;
                
                // On-the-fly name resolution before save/emit
                data = await resolveContactNames(data);
                
                await connection.query('UPDATE whatsapp_logs SET data = ? WHERE id = ?', [JSON.stringify(data), statusUpdate.id]);
                
                if (req.io) req.io.emit('whatsapp_update', data);
            }
        }
        connection.release();
    } catch (e) { console.error(e); }
});

export async function resolveContactNames(logsOrLog) {
    if (!logsOrLog) return logsOrLog;
    const isArray = Array.isArray(logsOrLog);
    const logs = isArray ? logsOrLog : [logsOrLog];
    if (logs.length === 0) return logsOrLog;
    try {
        const pool = getPool();
        if (!pool) return logsOrLog;
        const connection = await pool.getConnection();
        const [customerRows] = await connection.query("SELECT contact, name FROM customers");
        connection.release();
        
        const nameMap = {};
        for (const r of customerRows) {
            const cleanPhone = normalizePhone(r.contact);
            if (cleanPhone && r.name && r.name !== 'Unknown') {
                nameMap[cleanPhone] = r.name;
            }
        }
        
        const resolved = logs.map(log => {
            if (!log) return log;
            const cleanPhone = normalizePhone(log.phoneNumber || log.phone);
            if (nameMap[cleanPhone]) {
                if (!log.customerName || log.customerName === 'Customer' || log.customerName.toLowerCase() === 'empty' || log.customerName !== nameMap[cleanPhone]) {
                    log.customerName = nameMap[cleanPhone];
                }
            } else if (log.customerName && log.customerName.toLowerCase() === 'empty') {
                log.customerName = 'Customer';
            }
            return enrichLogMedia(log);
        });
        return isArray ? resolved : resolved[0];
    } catch (e) {
        console.error("[WhatsApp] Name resolution error:", e);
        return logsOrLog;
    }
}

// Proxy WhatsApp Media Download
router.get('/media/:mediaId', async (req, res) => {
    try {
        const { mediaId } = req.params;
        if (!mediaId || mediaId === 'undefined' || mediaId === 'null') {
            return res.status(400).send("Invalid media ID");
        }

        // 1. Check if the file already exists locally in /uploads/
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        } else {
            const files = fs.readdirSync(UPLOADS_DIR);
            const matchedFile = files.find(f => f.startsWith(`wa_media_${mediaId}.`));
            if (matchedFile) {
                const fullPath = path.join(UPLOADS_DIR, matchedFile);
                return res.sendFile(fullPath);
            }
        }

        // 2. Fetch WhatsApp API credentials
        let phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        let token = process.env.WHATSAPP_PERMANENT_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

        try {
            const pool = getPool();
            if (pool) {
                const connection = await pool.getConnection();
                const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['whatsapp']);
                connection.release();
                if (rows.length > 0) {
                    const config = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
                    if (config) {
                        if (config.token || config.accessToken || config.whatsappBusinessToken) {
                            token = config.token || config.accessToken || config.whatsappBusinessToken;
                        }
                        if (config.phoneNumberId || config.whatsappPhoneNumberId) {
                            phoneId = config.phoneNumberId || config.whatsappPhoneNumberId;
                        }
                    }
                }
            }
        } catch (e) {
            console.error("[WhatsApp Media] Error fetching DB config:", e.message);
        }

        if (!token) {
            console.error("[WhatsApp Media] Missing WhatsApp permanent access token");
            return res.status(401).send("WhatsApp access token not configured");
        }

        // 3. Query Graph API for media URL
        const metaRes = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${mediaId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!metaRes.ok) {
            const errText = await metaRes.text();
            console.error(`[WhatsApp Media] Graph API metadata error (${metaRes.status}):`, errText);
            return res.status(metaRes.status).send(`Failed to get media info from Meta: ${metaRes.statusText}`);
        }

        const metaData = await metaRes.json();
        const downloadUrl = metaData.url;
        const mimeType = metaData.mime_type || 'image/jpeg';

        if (!downloadUrl) {
            return res.status(404).send("Download URL not found in Meta response");
        }

        // 4. Download binary file from Meta lookaside URL
        const binaryRes = await fetch(downloadUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'AuraGold-Server/2.0'
            }
        });

        if (!binaryRes.ok) {
            console.error(`[WhatsApp Media] Download binary error (${binaryRes.status}):`, binaryRes.statusText);
            return res.status(binaryRes.status).send("Failed to download media binary from Meta");
        }

        const arrayBuffer = await binaryRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 5. Save locally to /uploads/ for future instant access
        let ext = 'jpg';
        if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('gif')) ext = 'gif';
        else if (mimeType.includes('pdf')) ext = 'pdf';
        else if (mimeType.includes('mp4')) ext = 'mp4';
        else if (mimeType.includes('ogg')) ext = 'ogg';

        const saveFilename = `wa_media_${mediaId}.${ext}`;
        const savePath = path.join(UPLOADS_DIR, saveFilename);

        try {
            fs.writeFileSync(savePath, buffer);
            console.log(`[WhatsApp Media] Saved media binary to ${savePath} (${Math.round(buffer.length/1024)} KB)`);
        } catch (saveErr) {
            console.error("[WhatsApp Media] Failed to write media file to disk:", saveErr.message);
        }

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.send(buffer);
    } catch (err) {
        console.error("[WhatsApp Media Proxy Exception]:", err);
        return res.status(500).send("Server error processing media download");
    }
});

router.get('/logs/poll', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 150');
        connection.release();
        
        let logs = rows.map(r => JSON.parse(r.data));
        logs = await resolveContactNames(logs);
        
        res.json({ success: true, logs });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/templates', ensureDb, async (req, res) => {
    let wabaId = req.headers['x-waba-id'];
    let token = req.headers['x-auth-token'];

    // Fallback to database integrations if headers are not provided
    if (!wabaId || !token) {
        try {
            const pool = getPool();
            const connection = await pool.getConnection();
            const [rows] = await connection.query("SELECT config FROM integrations WHERE provider = ?", ['whatsapp']);
            connection.release();
            if (rows.length > 0) {
                const config = typeof rows[0].config === "string" ? JSON.parse(rows[0].config) : rows[0].config;
                wabaId = wabaId || config.accountId || config.wabaId || config.whatsappBusinessAccountId;
                token = token || config.token || config.accessToken;
            }
        } catch (e) {
            console.error("[Meta Templates] Failed to load credentials from DB:", e.message);
        }
    }

    if (!wabaId || !token) return res.status(401).json({ success: false, error: "Missing Credentials" });

    try {
        let allTemplates = [];
        let nextUrl = `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates?limit=100`;

        while (nextUrl) {
            const r = await fetch(nextUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await r.json();
            
            if (data.error) {
                console.error("Meta Fetch Error:", JSON.stringify(data.error));
                return res.status(400).json({ success: false, error: data.error, raw: data });
            }

            if (data.data && Array.isArray(data.data)) {
                allTemplates = [...allTemplates, ...data.data];
            }
            
            nextUrl = data.paging?.next || null;
        }

        const pool = getPool();
        const connection = await pool.getConnection();
        
        // Clear stale templates from DB before saving templates for the currently active WABA ID
        await connection.query('DELETE FROM templates');

        for (const tpl of allTemplates) {
            const appTpl = { 
                id: tpl.id, 
                name: tpl.name, 
                category: tpl.category, 
                content: tpl.components?.find(c => c.type === 'BODY')?.text || '', 
                status: tpl.status, 
                source: 'META', 
                structure: tpl.components, 
                rejectionReason: tpl.rejected_reason 
            };
            await connection.query(`INSERT INTO templates (id, name, category, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), data=VALUES(data)`, [tpl.id, tpl.name, tpl.category, JSON.stringify(appTpl)]);
        }
        connection.release();
        
        res.json({ success: true, data: allTemplates });
    } catch (e) {
        console.error("[Meta Sync] Fatal Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

function sanitizeComponents(components) {
    if (!Array.isArray(components)) return components;
    return components.map(c => {
        if (!c) return c;
        if (c.type === 'BODY' && c.text) {
            const matches = c.text.match(/\{\{([0-9]+)\}\}/g) || [];
            const nums = matches.map(m => parseInt(m.replace(/[^0-9]/g, ''), 10));
            const maxIdx = nums.length > 0 ? Math.max(...nums) : 0;
            if (maxIdx > 0) {
                let existingEx = c.example?.body_text?.[0] || [];
                let safeEx = [];
                for (let i = 0; i < maxIdx; i++) {
                    let val = existingEx[i];
                    if (typeof val === 'string') val = val.trim();
                    if (!val) {
                        val = i === 0 ? 'Rahul Sharma' : i === 1 ? '₹25,000' : i === 2 ? 'ORD-10023' : `Sample ${i + 1}`;
                    }
                    safeEx.push(val);
                }
                c.example = { body_text: [safeEx] };
            }
        } else if (c.type === 'HEADER') {
            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format)) {
                const defaultMediaUrl = 
                    c.format === 'IMAGE' ? "https://images.unsplash.com/photo-1611591475178-57e05244f7db?auto=format&fit=crop&w=800&q=80" :
                    c.format === 'VIDEO' ? "https://www.w3schools.com/html/mov_bbb.mp4" :
                    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
                const existingUrl = c.example?.header_url?.[0] || c.example?.header_handle?.[0];
                c.example = { header_url: [existingUrl || defaultMediaUrl] };
            } else if (c.format === 'TEXT' && c.text && c.text.includes('{{1}}')) {
                if (!c.example || !c.example.header_text || !c.example.header_text[0]) {
                    c.example = { header_text: ['Sample Header'] };
                }
            }
        } else if (c.type === 'BUTTONS' && Array.isArray(c.buttons)) {
            c.buttons = c.buttons.map(b => {
                if (b.type === 'URL' && b.url && b.url.includes('{{1}}')) {
                    let ex = b.example?.[0];
                    if (typeof ex === 'string') ex = ex.trim();
                    if (!ex) ex = 'ORD-10023';
                    b.example = [ex];
                }
                return b;
            });
        }
        return c;
    });
}

router.post('/templates', ensureDb, async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    const payload = req.body;
    if (!wabaId || !token) return res.status(401).json({ success: false, error: "Missing Credentials" });

    if (payload.components) {
        payload.components = sanitizeComponents(payload.components);
    }

    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        if (data.error) {
            console.error("Meta Create Error:", JSON.stringify(data.error));
            return res.status(400).json({ success: false, error: data.error, raw: data });
        }

        const pool = getPool();
        const connection = await pool.getConnection();
        const newId = data.id;
        const appTpl = { id: newId, name: payload.name, category: payload.category, content: payload.components?.find(c => c.type === 'BODY')?.text || '', status: 'PENDING', source: 'META', structure: payload.components };
        await connection.query(`INSERT INTO templates (id, name, category, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), data=VALUES(data)`, [newId, payload.name, payload.category, JSON.stringify(appTpl)]);
        connection.release();
        
        await logDbActivity('TEMPLATE_CREATED', `Created Template: ${payload.name}`, { template: payload.name }, req);
        
        res.json({ success: true, data: data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/templates/:id', ensureDb, async (req, res) => {
    const templateId = req.params.id;
    const token = req.headers['x-auth-token'];
    const payload = req.body;
    if (!token) return res.status(401).json({ success: false, error: "Missing Credentials" });

    if (payload.components) {
        payload.components = sanitizeComponents(payload.components);
    }

    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${templateId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        if (data.error) {
            console.error("Meta Edit Error:", JSON.stringify(data.error));
            return res.status(400).json({ success: false, error: data.error, raw: data });
        }

        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT data FROM templates WHERE id = ?', [templateId]);
        let name = "Unknown";
        if (rows.length > 0) {
            const currentTpl = JSON.parse(rows[0].data);
            name = currentTpl.name;
            currentTpl.structure = payload.components;
            currentTpl.content = payload.components?.find(c => c.type === 'BODY')?.text || currentTpl.content;
            await connection.query(`UPDATE templates SET data = ? WHERE id = ?`, [JSON.stringify(currentTpl), templateId]);
        }
        connection.release();
        
        await logDbActivity('TEMPLATE_EDITED', `Updated Template: ${name}`, { templateId, name }, req);
        
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.delete('/templates', ensureDb, async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    const name = req.query.name;
    if (!wabaId || !token || !name) return res.status(400).json({ success: false, error: "Missing Params" });

    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates?name=${name}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await r.json();
        if (data.error) {
            console.error("Meta Delete Error:", JSON.stringify(data.error));
            return res.status(400).json({ success: false, error: data.error, raw: data });
        }

        const pool = getPool();
        const connection = await pool.getConnection();
        await connection.query('DELETE FROM templates WHERE name = ?', [name]);
        connection.release();
        
        await logDbActivity('TEMPLATE_DELETED', `Deleted Template: ${name}`, { name }, req);
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/send', ensureDb, async (req, res) => {
    const { to, message, templateName, language, components, customerName, sentBy, orderId } = req.body;
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];

    if (!phoneId || !token) {
        return res.status(401).json({ success: false, error: "Missing WhatsApp Credentials on Server" });
    }

    try {
        const result = await sendWhatsAppMessage({ to, message, templateName, language, components, customerName, phoneId, token, sentBy, orderId });
        await logDbActivity('WHATSAPP_SENT', templateName ? `Sent Template: ${templateName}` : 'Sent Manual Message', { recipient: to, customer: customerName, template: templateName, sentBy, orderId }, req);
        
        if (result.logEntry && req.io) {
            req.io.emit('whatsapp_update', result.logEntry);
        }
        
        res.status(200).json(result);
    } catch (e) {
        if (e.logEntry && req.io) {
            req.io.emit('whatsapp_update', e.logEntry);
        }
        res.status(400).json({ success: false, error: e.message, raw: e.raw || e.logEntry?.rawResponse || e, logEntry: e.logEntry });
    }
});

router.post('/edit', ensureDb, async (req, res) => {
    const { messageId, text } = req.body;
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];

    if (!phoneId || !token) {
        return res.status(401).json({ success: false, error: "Missing WhatsApp Credentials on Server" });
    }

    if (!messageId || !text) {
        return res.status(400).json({ success: false, error: "Missing messageId or text for editing" });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT data FROM whatsapp_logs WHERE id = ?', [messageId]);
        
        if (rows.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: "Original message not found in system logs" });
        }

        const logData = JSON.parse(rows[0].data);
        const recipientPhone = logData.phoneNumber || logData.phone;
        const customerName = logData.customerName || "Customer";
        const orderId = logData.orderId || null;

        // 1. Update the log in our database
        logData.message = text;
        logData.isEdited = true;
        logData.editedAt = new Date().toISOString();
        await connection.query('UPDATE whatsapp_logs SET data = ? WHERE id = ?', [JSON.stringify(logData), messageId]);
        
        // Emit to frontend if socket exists
        if (req.io) {
            req.io.emit('whatsapp_update', logData);
        }
        connection.release();

        // 2. Send a follow-up correction/retraction message via Meta's actual Cloud API
        // since Meta's API does not support in-place editing of sent messages for business numbers.
        let metaResponseData = null;
        let bodyText = `*Correction:* ${text}`;
        if (text.toLowerCase().includes('retracted')) {
            bodyText = `*Notice:* ${text}`;
        }

        try {
            const correctionPayload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: normalizePhone(recipientPhone),
                type: "text",
                text: {
                    body: bodyText
                }
            };

            const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(correctionPayload)
            });
            metaResponseData = await r.json();

            if (!r.ok || metaResponseData.error) {
                console.warn("Meta correction message send failed:", JSON.stringify(metaResponseData?.error));
            } else if (metaResponseData.messages && metaResponseData.messages[0]) {
                // Log the correction/retraction message as a new outbound message in the database too
                const correctionLogId = metaResponseData.messages[0].id;
                const correctionLog = {
                    id: correctionLogId,
                    customerName,
                    phoneNumber: normalizePhone(recipientPhone),
                    message: bodyText,
                    status: 'SENT',
                    timestamp: new Date().toISOString(),
                    direction: 'outbound',
                    type: 'CUSTOM',
                    sentBy: logData.sentBy || 'ADMIN',
                    orderId
                };
                
                const connection2 = await pool.getConnection();
                await connection2.query('INSERT INTO whatsapp_logs (id, phone, order_id, direction, timestamp, data) VALUES (?, ?, ?, ?, ?, ?)', 
                    [correctionLog.id, correctionLog.phoneNumber, orderId, 'outbound', new Date(), JSON.stringify(correctionLog)]);
                connection2.release();

                if (req.io) {
                    req.io.emit('whatsapp_update', correctionLog);
                }
            }
        } catch (sendErr) {
            console.error("Failed to send Meta correction message:", sendErr);
        }

        await logDbActivity('WHATSAPP_EDITED', `Edited Sent Message: ${messageId}`, { messageId, text }, req);

        res.json({ 
            success: true, 
            data: metaResponseData || { success: true, message: "Local log updated" }, 
            logEntry: logData 
        });
    } catch (e) {
        console.error("WhatsApp Message Edit Error:", e);
        res.status(400).json({ success: false, error: e.message });
    }
});

router.post('/test-breach/:orderId', ensureDb, async (req, res) => {
    const { orderId } = req.params;
    try {
        await checkRateBreaches(orderId, true);
        res.status(200).json({ success: true, message: `Breach check triggered for order ${orderId}` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/trigger-reminders', ensureDb, async (req, res) => {
    try {
        const results = await runPaymentReminders();
        res.status(200).json({ success: true, message: `Processed ${results.processedOrders || 0} orders. Sent ${results.remindersSent || 0} payment reminders.`, results });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/send-reminder/:orderId', ensureDb, async (req, res) => {
    const { orderId } = req.params;
    try {
        const results = await runPaymentReminders(orderId);
        if (results.remindersSent > 0) {
            res.status(200).json({ success: true, message: `Payment reminder sent successfully for order ${orderId}!`, results });
        } else if (results.skipped > 0) {
            res.status(200).json({ success: true, message: `Reminder skipped (already sent today or max limit reached).`, results });
        } else {
            res.status(200).json({ success: true, message: `No pending or overdue milestones found requiring a reminder today.`, results });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
