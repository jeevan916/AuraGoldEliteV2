# AuraGold Elite V2 — Project Security & Architecture Directives

## 1. Zero Insecure Fallbacks Policy
- **Never Fail Open**: Under no circumstances should error handlers, environment fallbacks, or failure paths bypass authentication, authorization, or IP security checks.
- **Explicit Access Denied**: If a security check fails or an unexpected state occurs in production, the application MUST reject the request (e.g., HTTP 401, 403, or 500) rather than falling back to an unauthenticated or permissive state.
- **No Production Bypass**: Webhook signature verification, Setu API authorization, JWT verification, and IP filtering must NEVER be disabled or bypassed when running in production (`NODE_ENV=production`).

## 2. Environment & Hostinger Deployment Safety
- **Environment Isolation**: Strictly separate development (Vite middleware / dev server) and production (bundled static assets + Express backend).
- **Socket and Port Safety**: Ensure `server.js` cleanly handles numeric ports (e.g. 3000) as well as Unix domain sockets (`PORT=/tmp/...`) used by web hosts (Hostinger/Passenger).
- **Apache Proxy (.htaccess)**: Maintain the `.htaccess` reverse proxy rules to strictly pass numeric environment ports to Node.js and block unwhitelisted direct access to sensitive internal endpoints.

## 3. API & Data Security
- **Strict Parameter Validation**: Validate all incoming parameters, query strings, and request bodies before executing database queries or external API calls.
- **SQL / Injection Defense**: Use parameterized queries (`?` or `$1`) across all database operations in `api/db.js` and other API files. Never concatenate raw user input into SQL queries.
- **Secret Hygiene**: All API keys (Setu, WhatsApp, JWT secrets, DB passwords) must strictly remain in environment variables (`process.env`) on the backend server and MUST NOT be exposed in client-side bundles or public endpoints.

## 4. Code Maintenance & Context
- Before completing any task, verify that no regression, security vulnerability, or insecure fallback has been introduced.
- Run `lint_applet` and `compile_applet` to confirm zero compilation or type errors.
