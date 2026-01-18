
# 🧠 Memory Module: Server & Core Architecture

## 🎯 Purpose
The backbone of the AuraGold Elite application. It serves the React frontend, manages the MySQL database connection, handles API routes, and ensures environment security.

## 🛠 Key Components
*   `server.js`: Main Node.js Express entry point.
*   `App.tsx`: Frontend root, routing, and initialization logic.
*   `storageService.ts`: Synchronization bridge between LocalStorage (optimistic UI) and MySQL.
*   `errorService.ts`: Global error trapping and AI diagnosis reporter.
*   `vite.config.ts`: Build configuration.

## 🚀 Recent Improvements (v5.0 Node.js Edition)
1.  **Migration from PHP to Node.js**: Replaced the legacy PHP proxy with a robust `express` server for better persistent connections and security.
2.  **Static Serving Logic**: Fixed critical routing issues where `index.html` was being served from source instead of `dist`, causing browser crashes. Implemented priority checks (`dist/` > `root`).
3.  **Database Self-Healing**: Implemented `ensureDb` middleware in `server.js` that attempts to reconnect to MySQL automatically if the connection pool drops.
4.  **Infinite Loop Fix**: Corrected `useEffect` dependency arrays in `App.tsx` to prevent the "Sync" logic from triggering infinite re-renders.
5.  **Strict Env Loading**: Added logic to load `.env` from multiple potential paths to support various hosting environments (Hostinger/cPanel/Local).

## 🔮 Future Roadmap
*   **WebSockets (Socket.io)**: Replace the current polling mechanism in `storageService` with real-time events for instant multi-device sync.
*   **Redis Caching**: Implement Redis for session management and caching frequent queries (like Gold Rates) to reduce DB load.
*   **Dockerization**: Create a `Dockerfile` for containerized deployment.
*   **Rate Limiting**: Add `express-rate-limit` to API routes to prevent abuse.
