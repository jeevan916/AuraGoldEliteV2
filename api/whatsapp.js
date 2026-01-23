
import express from 'express';
import { getPool, ensureDb, normalizePhone, logDbActivity } from './db.js';

const router = express.Router();
const META_API_VERSION = "v20.0";

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
            
            if (req.io) req.io.emit('whatsapp_update', logEntry);
        }

        if (change.statuses && change.statuses[0]) {
            const statusUpdate = change.statuses[0];
            const [rows] = await connection.query('SELECT data FROM whatsapp_logs WHERE id = ?', [statusUpdate.id]);
            if (rows.length > 0) {
                const data = JSON.parse(rows[0].data);
                data.status = statusUpdate.status.toUpperCase();
                await connection.query('UPDATE whatsapp_logs SET data = ? WHERE id = ?', [JSON.stringify(data), statusUpdate.id]);
                
                if (req.io) req.io.emit('whatsapp_update', data);
            }
        }
        connection.release();
    } catch (e) { console.error(e); }
});

router.get('/logs/poll', ensureDb, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT data FROM whatsapp_logs ORDER BY timestamp DESC LIMIT 150');
        connection.release();
        res.json({ success: true, logs: rows.map(r => JSON.parse(r.data)) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/templates', ensureDb, async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    if (!wabaId || !token) return res.status(401).json({ success: false, error: "Missing Credentials" });

    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await r.json();
        if (data.error) {
            const pool = getPool();
            const connection = await pool.getConnection();
            await connection.query(
                'INSERT INTO system_errors (id, source, message, stack, severity, timestamp, context) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [`WA-ERR-${Date.now()}`, 'Meta Template Fetch', data.error.message, '', 'HIGH', new Date(), JSON.stringify(data.error)]
            );
            connection.release();
            return res.status(400).json({ success: false, error: data.error, raw: data });
        }

        const pool = getPool();
        const connection = await pool.getConnection();
        const templates = data.data || [];
        for (const tpl of templates) {
            const appTpl = { id: tpl.id, name: tpl.name, category: tpl.category, content: tpl.components?.find(c => c.type === 'BODY')?.text || '', status: tpl.status, source: 'META', structure: tpl.components, rejectionReason: tpl.rejected_reason };
            await connection.query(`INSERT INTO templates (id, name, category, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), data=VALUES(data)`, [tpl.id, tpl.name, tpl.category, JSON.stringify(appTpl)]);
        }
        connection.release();
        res.json({ success: true, data: data.data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/templates', ensureDb, async (req, res) => {
    const wabaId = req.headers['x-waba-id'];
    const token = req.headers['x-auth-token'];
    const payload = req.body;
    if (!wabaId || !token) return res.status(401).json({ success: false, error: "Missing Credentials" });

    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        if (data.error) return res.status(400).json({ success: false, error: data.error, raw: data });

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

    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${templateId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        if (data.error) return res.status(400).json({ success: false, error: data.error, raw: data });

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
        if (data.error) return res.status(400).json({ success: false, error: data.error, raw: data });

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
    const { to, message, templateName, language, components, customerName } = req.body;
    const phoneId = req.headers['x-phone-id'];
    const token = req.headers['x-auth-token'];

    if (!phoneId || !token) {
        return res.status(401).json({ success: false, error: "Missing WhatsApp Credentials on Server" });
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
    
    // Log the Trigger Event (Who clicked "Send")
    const actionDesc = templateName ? `Sent Template: ${templateName}` : 'Sent Manual Message';
    await logDbActivity('WHATSAPP_SENT', actionDesc, { recipient: to, customer: customerName, template: templateName }, req);

    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        
        if (!r.ok || data.error) {
             const pool = getPool();
             const connection = await pool.getConnection();
             await connection.query(
                'INSERT INTO system_errors (id, source, message, stack, severity, timestamp, context) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    `WA-SEND-ERR-${Date.now()}`, 
                    'WhatsApp Send API', 
                    `Failed to send ${templateName || 'Message'}`, 
                    data.error.message || 'Unknown Meta Error', 
                    'HIGH', 
                    new Date(), 
                    JSON.stringify({ payload, error: data.error })
                ]
             );
             connection.release();
             return res.status(400).json({ success: false, error: data.error?.message || "Meta API Error", raw: data });
        }

        if (data.messages) {
            const pool = getPool();
            const connection = await pool.getConnection();
            const log = { id: data.messages[0].id, customerName: customerName || "Customer", phoneNumber: normalizePhone(to), message: templateName ? `[Template: ${templateName}]` : message, status: 'SENT', timestamp: new Date().toISOString(), direction: 'outbound', type: templateName ? 'TEMPLATE' : 'CUSTOM' };
            await connection.query('INSERT INTO whatsapp_logs (id, phone, direction, timestamp, data) VALUES (?, ?, ?, ?, ?)', [log.id, log.phoneNumber, 'outbound', new Date(), JSON.stringify(log)]);
            if (req.io) req.io.emit('whatsapp_update', log);
            connection.release();
        }
        res.status(r.status).json({ success: r.ok, data });
    } catch (e) { 
        res.status(500).json({ success: false, error: e.message }); 
    }
});

export default router;
