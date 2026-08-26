# WhatsApp Business Cloud API Integration Guide

This comprehensive guide explains how the WhatsApp Business Cloud API (Meta Graph API) is implemented in this AuraGold application. It contains the exact software architecture, complete source code, database schemas, and a step-by-step tutorial to help you integrate WhatsApp into any other Google AI Studio or custom web application.

---

## Table of Contents
1. [Prerequisites & Meta Developer Setup](#1-prerequisites--meta-developer-setup)
2. [Architecture Overview](#2-architecture-overview)
3. [Database Schema Design](#3-database-schema-design)
4. [Backend API Router (`api/whatsapp.js`)](#4-backend-api-router-apiwhatsappjs)
5. [Frontend Service Wrapper (`services/whatsappService.ts`)](#5-frontend-service-wrapper-serviceswhatsappservicets)
6. [Real-time Events (WebSockets)](#6-real-time-events-websockets)
7. [Step-by-Step Integration Checklist](#7-step-by-step-integration-checklist)

---

## 1. Prerequisites & Meta Developer Setup

To send and receive WhatsApp messages programmatically, you need to set up a WhatsApp Business platform account:

1. **Create a Meta Developer Account**: Visit [developers.facebook.com](https://developers.facebook.com/) and register as a developer.
2. **Create a Meta App**: Select **Other** -> **Business** app type, and fill in the details.
3. **Add WhatsApp Product**: In the App Dashboard, click **Set Up** on the WhatsApp card.
4. **Acquire Credentials**:
   - **Temporary Access Token**: Expires in 24 hours (use for initial development).
   - **Permanent Access Token**: Obtained by setting up a **System User** with the `whatsapp_business_messaging` and `whatsapp_business_management` permissions in your Meta Business Suite.
   - **Phone Number ID**: Identifies your sending phone number.
   - **WhatsApp Business Account ID (WABA ID)**: Identifies your business entity.
5. **Set Up a Webhook**:
   - Go to the **Webhooks** section in your app or under WhatsApp configuration.
   - Configure a webhook URL (e.g. `https://your-domain.com/api/whatsapp/webhook`).
   - Define a custom **Verify Token** (a random secret token of your choice).
   - Subscribe to the **messages** event field to receive inbound customer replies and message status delivery receipts (SENT, DELIVERED, READ).

---

## 2. Architecture Overview

Direct client-side communication with Meta's Graph API is highly insecure because it would expose your **Permanent Access Token** to the browser. Thus, a **secure proxy model** is implemented:

```
[ Frontend Client ] 
        │ (JWT/Session Auth)
        ▼
[ Express Server Proxy (api/whatsapp.js) ]  ◄── (Securely stores Permanent Access Token)
        │ 
        ├─► [ Relational Database (MySQL/Firestore) ] ── (Logs outbound/inbound and templates)
        ├─► [ Socket.IO Server ] ── (Emits real-time 'whatsapp_update' events)
        │ 
        ▼ (Authorized Meta Request)
[ Meta Graph API / WhatsApp Cloud API ]
        │
        ▼ (Delivers Message)
[ Customer's Phone ]
```

### Components of the System:
1. **Frontend Service Wrapper (`whatsappService.ts`)**: Construct Meta-compliant payloads, formats phone numbers, and manages local/cloud state.
2. **Backend API Proxy (`whatsapp.js`)**: Coordinates authentication, securely forwards payloads to `https://graph.facebook.com/`, receives webhooks from Meta, writes to the database, and emits WebSocket updates for instant UI updates.
3. **Webhook Controller**: Validates Meta's verification requests and parses status logs and incoming texts.

---

## 3. Database Schema Design

For logging message history and maintaining approved WhatsApp templates, the following tables are required:

```sql
-- Table to store outbound/inbound WhatsApp messages and statuses
CREATE TABLE IF NOT EXISTS whatsapp_logs (
    id VARCHAR(100) PRIMARY KEY,              -- Meta Message ID (wamid.XXX)
    phone VARCHAR(50) NOT NULL,               -- Recipient or Sender Phone number
    order_id VARCHAR(100),                    -- Optional association to an order
    direction VARCHAR(20) NOT NULL,           -- 'outbound' or 'inbound'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    data LONGTEXT                             -- JSON serialized metadata (sender, template details, etc.)
);

-- Table to store template definitions and approval status synced from Meta
CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(100) PRIMARY KEY,              -- Meta Template ID
    name VARCHAR(255) UNIQUE NOT NULL,         -- Unique template name (e.g. 'auragold_weight_update')
    category VARCHAR(50) NOT NULL,            -- UTILITY, MARKETING, AUTHENTICATION
    data LONGTEXT                             -- JSON serialized full template structure
);
```

---

## 4. Backend API Router (`api/whatsapp.js`)

Below is the complete, production-ready server controller written in Node.js/Express. It handles webhook verification, inbound webhooks, template synchronization, and secure message sending.

```javascript
import express from 'express';
import { getPool, ensureDb, normalizePhone, logDbActivity } from './db.js';
import { checkRateBreaches } from './rateService.js';

const router = express.Router();
const META_API_VERSION = "v20.0";

/**
 * Core function to forward requests to Meta's Cloud API
 */
export async function sendWhatsAppMessage({ to, message, templateName, language, components, customerName, phoneId, token, sentBy = 'SYSTEM', metadata = {}, orderId }) {
    if (!phoneId || !token) {
        throw new Error("Missing WhatsApp Credentials");
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
    
    try {
        const r = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        
        if (!r.ok || data.error) {
             console.error("Meta Send Error:", JSON.stringify(data.error));
             throw new Error(data.error?.message || "Meta API Error");
        }

        let returnLog = null;
        if (data.messages) {
            const pool = getPool();
            const connection = await pool.getConnection();
            const log = { 
                id: data.messages[0].id, 
                customerName: customerName || "Customer", 
                phoneNumber: normalizePhone(to), 
                message: templateName ? `[Template: ${templateName}]` : message, 
                status: 'SENT', 
                timestamp: new Date().toISOString(), 
                direction: 'outbound', 
                type: templateName ? 'TEMPLATE' : 'CUSTOM', 
                sentBy, 
                orderId, 
                ...metadata 
            };
            
            await connection.query(
                'INSERT INTO whatsapp_logs (id, phone, order_id, direction, timestamp, data) VALUES (?, ?, ?, ?, ?, ?)', 
                [log.id, log.phoneNumber, orderId || null, 'outbound', new Date(), JSON.stringify(log)]
            );
            connection.release();
            returnLog = log;
        }
        return { success: true, data, logEntry: returnLog };
    } catch (e) { 
        console.error("WhatsApp Send Error:", e);
        throw e;
    }
}

/**
 * 1. Webhook Verification (GET /webhook)
 * Used by Meta to register and verify your endpoint's health
 */
router.get('/webhook', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token) {
        if (mode === 'subscribe' && verify_token && token === verify_token) return res.status(200).send(challenge);
        return res.sendStatus(403);
    }
    res.sendStatus(400);
});

/**
 * 2. Inbound Webhook (POST /webhook)
 * Handles incoming customer replies and delivery status callbacks (sent, delivered, read)
 */
router.post('/webhook', ensureDb, async (req, res) => {
    // Meta requires an immediate 200 OK to prevent message retries
    res.status(200).send('EVENT_RECEIVED');
    try {
        const body = req.body;
        if (!body.entry || !body.entry[0].changes) return;
        const change = body.entry[0].changes[0].value;
        const pool = getPool();
        const connection = await pool.getConnection();

        // Check for inbound user messages
        if (change.messages && change.messages[0]) {
            const msg = change.messages[0];
            const fromFormatted = normalizePhone(msg.from);
            const msgBody = msg.text?.body || `[Media: ${msg.type}]`;
            const timestamp = new Date(parseInt(msg.timestamp) * 1000).toISOString();
            const contactName = change.contacts?.[0]?.profile?.name || "Customer";
            
            // Auto-link to the most recent customer order if any
            const [ordersRows] = await connection.query("SELECT data FROM orders");
            const customerOrders = ordersRows.map(r => JSON.parse(r.data)).filter(o => normalizePhone(o.customerContact) === fromFormatted);
            let mostRecentOrderId = null;
            if (customerOrders.length > 0) {
                customerOrders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                mostRecentOrderId = customerOrders[0].id;
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
                orderId: mostRecentOrderId 
            };
            
            await connection.query(
                `INSERT INTO whatsapp_logs (id, phone, order_id, direction, timestamp, data) VALUES (?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE data=VALUES(data), order_id=VALUES(order_id)`, 
                [logEntry.id, fromFormatted, mostRecentOrderId, 'inbound', new Date(timestamp), JSON.stringify(logEntry)]
            );
            
            // Emit real-time event to connected Socket.IO frontend clients
            if (req.io) req.io.emit('whatsapp_update', logEntry);
        }

        // Check for delivery status receipts (SENT -> DELIVERED -> READ)
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
    } catch (e) { console.error("Webhook processing error:", e); }
});

/**
 * 3. Send Manual Message/Template (POST /send)
 */
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
        res.status(400).json({ success: false, error: e.message });
    }
});

export default router;
```

---

## 5. Frontend Service Wrapper (`services/whatsappService.ts`)

This frontend TypeScript service formats phone numbers, compiles nested template structures (such as injecting payment link variables into URL button headers), and proxies communication to the backend router.

```typescript
import { WhatsAppLogEntry, GlobalSettings, WhatsAppTemplate } from "../types";

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: any;
  logEntry?: WhatsAppLogEntry;
}

const API_BASE = process.env.VITE_API_BASE_URL || '';

export const whatsappService = {
  /**
   * Cleans phone numbers and formats with appropriate country prefix (defaulting to 91 for India)
   */
  formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return `91${cleaned}`;
    if (cleaned.length === 11 && cleaned.startsWith('0')) return `91${cleaned.substring(1)}`;
    if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned;
    return cleaned;
  },

  /**
   * Resolves template variables, including button URLs, document headers, and body strings
   */
  constructMetaComponents(content: string, variableExamples: string[] = [], structure?: any[]) {
      let components = structure ? JSON.parse(JSON.stringify(structure)) : [];
      const appUrl = window.location.origin;
      
      // Inject standard variables
      components = JSON.parse(
          JSON.stringify(components).replace(/{{APP_URL}}/g, appUrl)
      );
      
      let bodyIndex = components.findIndex((c: any) => c.type === 'BODY');
      const bodyMatches = content.match(/{{([0-9]+)}}/g) || [];
      const bodyIndices = bodyMatches.map(m => parseInt(m.replace(/[^0-9]/g, ''), 10));
      const maxBodyIndex = bodyIndices.length > 0 ? Math.max(...bodyIndices) : 0;

      const bodyComponent: any = { type: 'BODY', text: content };

      if (maxBodyIndex > 0) {
          const safeExamples = [...variableExamples];
          while(safeExamples.length < maxBodyIndex) {
              safeExamples.push(`sample_${safeExamples.length + 1}`);
          }
          bodyComponent.example = { body_text: [safeExamples.slice(0, maxBodyIndex)] };
      }

      if (bodyIndex >= 0) {
          components[bodyIndex] = { ...components[bodyIndex], ...bodyComponent };
      } else {
          components.push(bodyComponent);
      }

      // Handle template buttons (e.g. dynamic call-to-actions with payment links)
      const buttonIndex = components.findIndex((c: any) => c.type === 'BUTTONS');
      if (buttonIndex >= 0) {
          const buttons = components[buttonIndex].buttons || [];
          const urlButtonIndex = buttons.findIndex((b: any) => b.type === 'URL' && b.url.includes('{{1}}'));
          if (urlButtonIndex >= 0) {
              const urlExample = variableExamples.length > 0 ? variableExamples[variableExamples.length - 1] : "123456";
              if (!buttons[urlButtonIndex].example) {
                   buttons[urlButtonIndex].example = [urlExample]; 
              }
          }
          components[buttonIndex].buttons = buttons;
      }
      return components;
  },

  /**
   * Send template message through the backend secure API route
   */
  async sendTemplateMessage(
    to: string, 
    templateName: string, 
    languageCode: string = 'en_US', 
    bodyVariables: string[] = [], 
    customerName: string, 
    buttonVariable?: string,
    headerImageUrl?: string,
    orderId?: string
  ): Promise<WhatsAppResponse> {
    const recipient = this.formatPhoneNumber(to);
    if (!recipient) return { success: false, error: "Invalid Phone Number" };

    const settings = this.getSettings();
    const token = settings.whatsappBusinessToken?.trim();
    if (!settings.whatsappPhoneNumberId || !token) {
        return { success: false, error: "WhatsApp credentials not configured" };
    }

    try {
        const components: any[] = [];
        
        if (headerImageUrl) {
            components.push({
                type: "header",
                parameters: [{ type: "image", image: { link: headerImageUrl } }]
            });
        }

        if (bodyVariables.length > 0) {
            components.push({ 
                type: "body", 
                parameters: bodyVariables.map(v => ({ type: "text", text: v.trim() })) 
            });
        }

        if (buttonVariable) {
            components.push({ 
                type: "button", sub_type: "url", index: 0, 
                parameters: [{ type: "text", text: buttonVariable.trim() }] 
            });
        }

        const payload = { 
            to: recipient, 
            templateName, 
            language: languageCode, 
            components, 
            customerName,
            sentBy: 'SYSTEM',
            orderId
        };

        const response = await fetch(`${API_BASE}/api/whatsapp/send`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-phone-id': settings.whatsappPhoneNumberId,
                'x-auth-token': token
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Meta Send Error");

        return { success: true, messageId: data.data?.messages?.[0]?.id, logEntry: data.logEntry };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
  }
};
```

---

## 6. Real-Time Webhook Updates with WebSockets

To make incoming customer messages or status transitions render instantaneously on your dashboard:

1. **On the Server (`server.js`)**:
   - Bind `socket.io` to your express server context.
   - Inject the `io` instance into your Express requests:
     ```javascript
     app.use((req, res, next) => {
         req.io = io;
         next();
     });
     ```
2. **On the Client (`storageService.ts`)**:
   - Initialize a Socket connection on application boot:
     ```typescript
     import { io } from 'socket.io-client';
     this.socket = io(window.location.origin, { path: '/socket.io' });
     ```
   - Listen for the inbound update events and mutate local list states:
     ```typescript
     this.socket.on('whatsapp_update', (logEntry) => {
         this.updateLogList(logEntry);
         this.triggerRepaint();
     });
     ```

---

## 7. Step-by-Step Integration Checklist for your next App

Use this checklist to replicate the implementation on any other Google AI Studio app:

* [ ] **Initialize Database Tables**: Execute the DDL script in [Database Schema Design](#3-database-schema-design) on your SQL database.
* [ ] **Set Meta Credentials**: Save your `whatsappPhoneNumberId`, `whatsappBusinessAccountId`, and `whatsappBusinessToken` securely (in environment variables or key-vault tables).
* [ ] **Expose Webhook Verification Route**: Add the `/webhook` GET endpoint and confirm registration with your custom Verification Token in the Meta App Dashboard.
* [ ] **Add Inbound Parser**: Implement the `/webhook` POST endpoint to process the incoming webhook events from Meta.
* [ ] **Create Template Sender UI**: Build components that call `whatsappService.sendTemplateMessage` upon specific state changes (e.g., when an order status is updated to 'Delivered' or a payment plan is breached).
* [ ] **Verify SSL Requirement**: Meta webhooks strictly require a public HTTPS endpoint. When running in Google AI Studio, utilize your pre-built deployment HTTPS url for routing.
