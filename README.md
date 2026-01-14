# 💎 AuraGold Elite - System Architecture

**Version:** 3.3.1 (MySQL Edition)
**Stack:** React 19, Vite, PHP (PDO), MySQL, Tailwind CSS, Gemini AI.

## 🧠 Business Logic & Core Philosophy

### 1. Purpose: Cash Flow Assurance Engine
This application is **not** a standard POS or a Debt Recovery tool for bad debts. It is a **proactive "Promise Keeper" system**.
*   **Context:** The jewelry is **retained** by the jeweler (in the vault) until the final payment is made.
*   **Goal:** Ensure the customer honors their payment schedule to maintain their contract benefits.
*   **Mechanism:** The app uses AI to nudge customers *before* or *immediately after* a due date to prevent cash flow gaps, ensuring the jeweler has the liquidity they planned for.

### 2. The Gold Rate Protection Contract
The core value proposition is protecting the customer from gold price hikes, but this is treated as a **Conditional Liability**.

*   **The Deal:** "We (the Jeweler) lock your rate at **₹6,600/g** today. You (the Customer) promise to pay **₹10k/month**."
*   **The Condition:** If the customer pays on time, the Jeweler absorbs the market volatility (Liability).
*   **The Breach (Lapse):** If the customer defaults on the payment schedule and ignores reminders, the "Rate Protection" is **REVOKED**.
    *   **Status: ACTIVE (Protected):** Final Price = Net Weight × **Booked Rate** (+ Making/Tax).
    *   **Status: LAPSED (Revoked):** Final Price = Net Weight × **Current Market Rate** (+ Making/Tax).

### 3. Order Lifecycle
1.  **Booking:** Order created, Rate locked, Payment Plan defined. Status: `ACTIVE`.
2.  **Collection:** Monthly payments tracked. AI "Cash Flow Engine" sends specific reminders based on "Loss Aversion" (don't lose your rate!).
3.  **Completion:** All milestones paid. Balance hits 0. Status: `COMPLETED` (Item ready for pickup).
4.  **Handover:** Physical item is given to the customer. Status: `DELIVERED`.
    *   *Note:* `DELIVERED` orders are **Archived** and excluded from live dashboard metrics to keep the financial view focused on pending cash flow.

---

## 💾 Critical Installation Step (Hostinger)

Because of deployment restrictions, the PHP files are generated as `.md` files. **You must rename them manually.**

1.  **Upload** the contents of the `dist/` folder to your Hostinger `public_html/` folder.
2.  Open **Hostinger File Manager** and navigate to `public_html/api/`.
3.  **Rename the files**:
    *   `db_config.md`  ➡️  `db_config.php`
    *   `server.md`     ➡️  `server.php`
    *   `test_db.md`    ➡️  `test_db.php`
4.  **Edit `db_config.php`**:
    *   Open the file.
    *   Replace `'YOUR_DB_PASSWORD'` with your actual database password.
    *   Save.

### Testing
Once renamed, open `https://your-domain.com/api/test_db.php` in your browser. It should return a JSON response saying "Success".

## 🛑 CORE PROTOCOLS

### 1. Mobile-First Design Language (iOS)
*   **Viewport:** Must use `viewport-fit=cover` to handle iPhone notches.
*   **Input Handling:** All inputs must have `font-size: 16px` to prevent iOS Safari from zooming.

### 2. Pricing Engine Logic
1.  **Metal Value** = Net Weight × Purity Rate (24K/22K/18K).
2.  **Wastage (VA)** = Metal Value × Percentage.
3.  **Labor (Making)** = Rate per gram × Net Weight.
4.  **Stone Charges** = Flat fee added.
5.  **Subtotal** = Metal + Wastage + Labor + Stone.
6.  **Final Total** = Subtotal + GST (default 3%).

---

## 🛠 Setup & Environment

1.  **Environment Variables:**
    Ensure `.env` exists with `VITE_API_KEY` (Gemini).
    
2.  **Deployment:**
    Upload `dist/` contents to `public_html/`.
    Ensure `api/` folder is uploaded and `db_config.php` is updated.