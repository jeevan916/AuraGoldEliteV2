
# 🧠 Memory Module: Settings & Configuration

## 🎯 Purpose
Central command center for technical configuration, market rates, and API keys.

## 🛠 Key Components
*   `components/Settings.tsx`: UI for managing all configs.
*   `server.js`: Handles the persistence of settings into the DB or `.env`.
*   `services/goldRateService.ts`: Manages the single source of truth for pricing.

## 🚀 Recent Improvements
1.  **Database Config UI**: Added a UI in Settings to manually input DB credentials if the connection fails, updating the server environment.
2.  **Catalog Management**: Moved Catalog out of code constants into the Database, editable via the Settings UI.
3.  **Lapse Strategy Config**: Added controls to define "Grace Period Hours" and "Follow-up Interval", making the recovery logic customizable.

## 🔮 Future Roadmap
*   **Multi-Store Support**: Add `branch_id` context to settings for chains.
*   **Role-Based Access (RBAC)**: "Admin" vs "Staff" views in Settings (hide API keys from Staff).
*   **Audit Logs**: Detailed history of who changed the Gold Rate and when.
