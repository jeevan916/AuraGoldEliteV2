
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
1.  **Client Aggregation Engine**:
    *   Implemented `derivedCustomers` logic in `App.tsx`.
    *   **Behavior**: Merges manual customer metadata (from `storageService`) with transactional data (from `orders`).
    *   **Benefit**: Ensures that even if a customer wasn't manually added to the directory, they appear in the "Client Directory" if they have an active order, grouped by their phone number.
2.  **Real-Time System Monitoring**:
    *   Wired `systemErrors` and `systemActivities` states in `App.tsx` directly to the `ErrorLogPanel`.
    *   The Desktop Sidebar now includes a direct link to "System Logs" for rapid debugging.
3.  **Migration from PHP to Node.js**: Replaced the legacy PHP proxy with a robust `express` server for better persistent connections and security.
4.  **Static Serving Logic**: Fixed critical routing issues where `index.html` was being served from source instead of `dist`, causing browser crashes. Implemented priority checks (`dist/` > `root`).
5.  **Database Self-Healing**: Implemented `ensureDb` middleware in `server.js` that attempts to reconnect to MySQL automatically if the connection pool drops.

## 🔮 Future Roadmap
*   **WebSockets (Socket.io)**: Replace the current polling mechanism in `storageService` with real-time events for instant multi-device sync.
*   **Redis Caching**: Implement Redis for session management and caching frequent queries (like Gold Rates) to reduce DB load.
*   **Dockerization**: Create a `Dockerfile` for containerized deployment.
*   **Rate Limiting**: Add `express-rate-limit` to API routes to prevent abuse.
