
# 🧠 Memory Module: WhatsApp & Communication Hub

## 🎯 Purpose
Enables direct, compliant communication with customers via the Meta WhatsApp Business API. Handles template management, chat logs, and automated triggers.

## 🛠 Key Components
*   `services/whatsappService.ts`: Core service wrapping Meta Graph API calls (proxied via backend).
*   `components/WhatsAppPanel.tsx`: Chat interface with template selection and history.
*   `components/WhatsAppTemplates.tsx`: "Template Architect" for creating, editing, and syncing templates with Meta.
*   `components/clusters/CommunicationWidget.tsx`: Embedded chat log for Order views.

## 🚀 Recent Improvements
1.  **Server-Side Proxy**: Moved all Meta API calls to `server.js` endpoints (`/api/whatsapp/*`) to strictly hide `ACCESS_TOKEN` from the frontend bundle.
2.  **Template Auto-Heal**: Created a system to detect missing "Core Templates" (e.g., Payment Reminder) and auto-recreate them in Meta if deleted.
3.  **Compliance Engine**: Added AI logic to pre-validate template content against Meta policies (e.g., flagging promotional words in Utility templates) before submission.
4.  **In-Place Editing**: Added logic to support editing existing Meta templates without changing their name (to preserve history).

## 🔮 Future Roadmap
*   **Media Support**: Allow sending images (Jewelry photos) and PDFs (Invoices) directly via the chat panel.
*   **Webhooks**: Implement a webhook listener in `server.js` to receive incoming messages in real-time (currently polling/manual refresh).
*   **Drip Campaigns**: Automated marketing sequences for "Anniversary" or "Festival" offers.
