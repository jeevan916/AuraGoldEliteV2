
# 💎 AuraGold Elite - System Architecture

**Version:** 5.0.0 (Node.js Edition)
**Stack:** React 19, Vite, Node.js (Express), MySQL, Tailwind CSS, Gemini AI.

## 🧠 Application Structure

This is a **Full-Stack JavaScript Application**.

1.  **Frontend:** A pure React Single Page Application (SPA).
2.  **Backend:** A Node.js Express server (`server.js`) that serves the React app and handles API requests.
3.  **Database:** MySQL.

### 1. Purpose: Cash Flow Assurance Engine
This application is a proactive "Promise Keeper" system for high-end jewelry management.
*   **Context:** The jewelry is **retained** by the jeweler until the final payment.
*   **Goal:** Ensure customers honor payment schedules.
*   **Mechanism:** AI-driven nudges and "Gold Rate Protection" contracts.

### 2. Order Lifecycle
1.  **Booking:** Rate locked, Payment Plan defined. Status: `ACTIVE`.
2.  **Collection:** Monthly payments tracked.
3.  **Completion:** Balance hits 0. Status: `COMPLETED`.
4.  **Handover:** Item delivered. Status: `DELIVERED` (Archived).

---

## 🚀 Deployment Instructions (Hostinger VPS / Shared Node.js)

Since this app uses a Node.js backend, you must use the **Node.js Selector** or a VPS. **Do not** treat this as a static HTML/PHP site.

### Step 1: Prepare Database
1.  Create a MySQL Database in your control panel.
2.  Note down the: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
3.  The application will **automatically** create the necessary tables (`aura_app_state`) on the first run.

### Step 2: Configure Environment
In your hosting panel (or `.env` file), set these variables:
*   `DB_HOST`
*   `DB_USER`
*   `DB_PASSWORD`
*   `DB_NAME`
*   `API_KEY` (Your Google Gemini API Key)
*   `PORT` (Usually handled automatically by Hostinger, but can be set to 3000)

### Step 3: Deployment
The GitHub Action is configured to:
1.  Build the React App (`npm run build`).
2.  Move `server.js` and `package.json` into the build folder.
3.  Upload everything to `public_html`.

**After upload:**
1.  Go to your hosting panel's **Node.js Selector**.
2.  Select the `public_html` folder.
3.  **IMPORTANT:** Set "Application Startup File" to `server.js`.
4.  Click **Run NPM Install**.
5.  Click **Restart Application**.

---

## 🛑 CORE PROTOCOLS

### 1. Mobile-First Design
*   **Viewport:** Uses `viewport-fit=cover` for notch support.
*   **Input Handling:** Font sizes optimized to prevent iOS Safari zooming.

### 2. Pricing Engine
1.  **Metal Value** = Net Weight × Purity Rate.
2.  **Final Total** = Metal + Wastage + Labor + Stone + GST.

