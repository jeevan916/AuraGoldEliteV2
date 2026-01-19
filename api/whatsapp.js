import express from 'express';
import { getPool, ensureDb, normalizePhone } from './db.js';

const router = express.Router();
const META_API_VERSION = "v22.0";

// Webhook Verification
router.get('/webhook', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN || "auragold_elite_secure_2025";
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
            const msgBody = msg.text?.body || `[Media: ${msg.type}]`;
            const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
            const contactName = change.contacts?.[0]?.profile?.name || "Customer";
            const logEntry = { id: msg.id, customerName: contactName, phoneNumber: fromFormatted, message: msgBody, status: 'READ', timestamp, direction: 'inbound', type: 'INBOUND' };
            await connection.query(`INSERT INTO whatsapp_logs (id, phone, direction, timestamp, data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data)`, [logEntry.id, fromFormatted, 'inbound', new Date(timestamp), JSON.stringify(logEntry)]);
        }

        if (change.statuses && change.statuses[0]) {
            const statusUpdate = change.statuses[0];
            const [rows] = await connection.query('SELECT data FROM whatsapp_logs WHERE id = ?', [statusUpdate.id]);
            if (rows.length > 0) {
                const data = JSON.parse(rows[0].data);
                data.status = statusUpdate.status.toUpperCase();
                await connection.query('UPDATE whatsapp_logs SET data = ? WHERE id = ?', [JSON.stringify(data), statusUpdate.id]);
            }
        }
        connection.release();
    } catch (e) { console.error(e); }
});

// Logs Polling
router.get('/logs/poll', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 150');
        connection.release();
        res.json({ success: true, logs: rows.map(r => JSON.parse(r.data)) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TEMPLATE MANAGEMENT ROUTES ---

// Fetch Templates from Meta
router.get('/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    
    if (!wabaId || !token) return res.status(400).json({ success: false, error: "Missing WABA credentials" });

    try {
        const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        res.status(response.status).json({ success: response.ok, data: data.data, error: data.error?.message });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Create Template in Meta
router.post('/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    
    if (!wabaId || !token) return res.status(400).json({ success: false, error: "Missing WABA credentials" });

    try {
        const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.status(response.status).json({ success: response.ok, data: data, error: data.error?.message });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Edit Template in Meta
router.post('/templates/:id', async (req, res) => {
    const token = req.headers['x-auth-token'];
    const { id } = req.params;
    
    if (!token) return res.status(400).json({ success: false, error: "Missing Auth Token" });

    try {
        const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.status(response.status).json({ success: response.ok, data: data, error: data.error?.message });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Delete Template in Meta
router.delete('/templates', async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    const name = req.query.name;
    
    if (!wabaId || !token || !name) return res.status(400).json({ success: false, error: "Missing credentials or template name" });

    try {
        const response = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates?name=${name}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        res.status(response.status).json({ success: response.ok, data: data, error: data.error?.message });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Send Message
router.post('/send', ensureDb, async (req, res) => {
    const { to, message, templateName, language, components, customerName } = req.body;
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];
    
    if (!phoneId || !token) return res.status(400).json({ success: false, error: "Missing Phone ID or Token" });

    let payload = { messaging_product: "whatsapp", to: normalizePhone(to) };
    if (templateName) payload.template = { name: templateName, language: { code: language || "en_US" }, components };
    else payload.text = { body: message };
    
    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        if (r.ok && data.messages) {
            const pool = getPool();
            const connection = await pool.getConnection();
            const log = { id: data.messages[0].id, customerName: customerName || "Customer", phoneNumber: normalizePhone(to), message: templateName ? `[Template: ${templateName}]` : message, status: 'SENT', timestamp: new Date().toISOString(), direction: 'outbound', type: templateName ? 'TEMPLATE' : 'CUSTOM' };
            await connection.query('INSERT INTO whatsapp_logs (id, phone, direction, timestamp, data) VALUES (?, ?, ?, ?, ?)', [log.id, log.phoneNumber, 'outbound', new Date(), JSON.stringify(log)]);
            connection.release();
        }
        res.status(r.status).json({ success: r.ok, data, error: data.error?.message });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

export default router;