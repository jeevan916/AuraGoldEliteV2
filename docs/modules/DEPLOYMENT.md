
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
The `server.js` file is the entry point. It now features **Smart Path Detection** to handle different deployment structures:

*   **Production Mode:** If `server.js` detects `index.html` in its *current directory*, it assumes it has been moved inside the build folder (common in CI/CD pipelines) and serves files from `.`.
*   **Development Mode:** If `server.js` detects `dist/index.html`, it assumes it is running from the project root and serves files from `./dist`.

### 3. Environment Variables (`.env`)
The server looks for `.env` in:
1.  Current Directory
2.  `__dirname`
3.  Parent Directory
4.  `/home/public_html/.env` (Hostinger convention)

### ⚠️ Common Issues & Fixes

**Issue:** "I see a white page" or "I see source code index.html"
*   **Cause:** The server is serving the *source* `index.html` because `dist` is missing or misconfigured.
*   **Fix:** Run `npm run build`.

**Issue:** "API Endpoint Not Found"
*   **Cause:** You are hitting a route like `/api/login` that isn't defined in `server.js`.
*   **Fix:** Check `server.js` routes.

**Issue:** "Database Unavailable"
*   **Cause:** `.env` credentials are wrong or DB user doesn't have permissions.
*   **Fix:** Use the `/api/health` endpoint to debug.

## 🔮 Future Roadmap
*   **CI/CD Pipeline:** Automate `npm run build` on git push.
*   **PM2 Integration:** Use PM2 `ecosystem.config.js` for process management.
