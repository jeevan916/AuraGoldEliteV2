
# 💎 AuraGold Elite - System Architecture

**Version:** 3.3.0 (MySQL Edition)
**Stack:** React 19, Vite, PHP (PDO), MySQL, Tailwind CSS, Gemini AI.

## 💾 Database Setup (Hostinger MySQL)

The application now uses a live MySQL database instead of JSON files.

### 1. Database Credentials
The app is pre-configured to look for:
*   **Database:** `u477692720_AuraGoldElite`
*   **User:** `u477692720_jeevan1`

### 2. Critical Installation Step
After uploading the files to Hostinger, you **MUST** perform this manual step:

1.  Open **Hostinger File Manager**.
2.  Navigate to `public_html/api/`.
3.  Open `db_config.php`.
4.  Replace `'YOUR_DB_PASSWORD'` with your actual database password.
5.  Save the file.

### 3. How it Works
*   The frontend (React) works offline using `LocalStorage`.
*   Every 10 seconds, it syncs with `public/api/server.php`.
*   `server.php` connects to your MySQL database and saves data into a table named `app_storage`.
*   The table is created automatically if it doesn't exist.

---

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
