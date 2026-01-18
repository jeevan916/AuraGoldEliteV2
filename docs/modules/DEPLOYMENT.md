
# 🧠 Memory Module: Deployment & Server Architecture

## 🎯 Purpose
Tracks the build process, server configuration, and environment setup required to run AuraGold Elite on Hostinger (Node.js) or VPS environments.

## 🛠 Key Files
*   `server.js`: The Express.js web server. It serves the frontend and proxies API requests.
*   `vite.config.ts`: Configures the React build output (`dist/`).
*   `.htaccess`: Routes traffic to the Node.js process (specific to Hostinger/Apache).
*   `package.json`: Contains `npm run build` and `start` scripts.

## 🚀 Deployment Protocol

### 1. Build the Application
The application is a "Single Page App" (SPA). Browsers cannot read `.tsx` source files directly. You must compile them into standard JavaScript (`.js`) files.

**Command:**
```bash
npm run build
```
**Output:** Creates a `dist/` folder containing `index.html` and an `assets/` folder.

### 2. Server Startup (`server.js`)
The `server.js` file is the entry point. It features **Automatic Conflict Resolution**:

*   **Auto-Fix Feature:** On startup, `server.js` checks for a `dist/` folder. If found, and if it also sees a source `index.html` in the root, it **automatically renames the root `index.html`** to `index.html.original_source`.
*   **Why?** Many web servers (Apache/LiteSpeed) prioritize serving files in the root folder over the Node.js application logic. By renaming the root file, we force the server to use the Node.js app which correctly serves `dist/`.

### 3. Environment Variables (`.env`)
The server looks for `.env` in:
1.  Current Directory
2.  `__dirname`
3.  Parent Directory
4.  `/home/public_html/.env` (Hostinger convention)

### ⚠️ Common Issues & Fixes

**Issue:** "White Screen" or "MIME type error"
*   **Cause:** The server is serving the *source code* `index.html` (which links to `.tsx` files) instead of the built `dist/index.html`.
*   **Fix:** **Restart the Node.js Application.** The new `server.js` will automatically detect this and rename the root `index.html` to fix it.

**Issue:** "App Not Built" Screen
*   **Cause:** The server cannot find `dist/index.html` and has correctly rejected the root `index.html` to prevent a crash.
*   **Fix:** Run `npm run build` locally and upload the `dist` folder.

**Issue:** "Database Unavailable"
*   **Cause:** `.env` credentials are wrong or DB user doesn't have permissions.
*   **Fix:** Use the `/api/health` endpoint to debug.

## 🔮 Future Roadmap
*   **CI/CD Pipeline:** Automate `npm run build` on git push.
*   **PM2 Integration:** Use PM2 `ecosystem.config.js` for process management.
