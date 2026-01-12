# 💎 AuraGold Elite - System Architecture

**Version:** 3.3.1 (MySQL Edition)
**Stack:** React 19, Vite, PHP (PDO), MySQL, Tailwind CSS, Gemini AI.

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