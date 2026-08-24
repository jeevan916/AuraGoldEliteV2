import { getPool } from '../db.js';

/**
 * Setu UPI Redirector
 * Decodes a base64 UPI intent, unwraps nested links, and redirects to it.
 * This is used to bypass Meta's restriction on non-http schemes in URL buttons.
 */
export function resolvePaymentIntent(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let curr = raw.trim();

    for (let depth = 0; depth < 5; depth++) {
        if (!curr) break;

        // Strip leading/trailing slashes
        curr = curr.replace(/^\/+|\/+$/g, '');

        // Direct target match
        if (curr.startsWith('upi://') || curr.startsWith('https://setu.co') || curr.startsWith('https://uat.setu.co')) {
            return curr;
        }

        // If it contains /setu/pay/
        if (curr.includes('/setu/pay/')) {
            const parts = curr.split('/setu/pay/');
            const suffix = parts[parts.length - 1];
            if (suffix && suffix !== curr) {
                curr = suffix;
                continue;
            }
        }

        // Try base64 decoding
        try {
            const normalized = curr.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = Buffer.from(normalized, 'base64').toString('utf8');
            if (decoded && decoded !== curr && (
                decoded.startsWith('upi://') || 
                decoded.startsWith('https://') || 
                decoded.startsWith('http://') || 
                decoded.includes('/setu/pay/')
            )) {
                curr = decoded;
                continue;
            }
        } catch (e) {
            // Not base64
        }

        break;
    }

    return curr;
}

export function renderRedirectHtml(intent) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Redirecting to UPI...</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0; 
            background: #f8fafc; 
            color: #1e293b;
        }
        .card { 
            background: white; 
            padding: 2.5rem; 
            border-radius: 1.5rem; 
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); 
            text-align: center; 
            max-width: 400px; 
            width: 90%;
        }
        .logo { 
            font-size: 2rem; 
            font-weight: 900; 
            color: #10b981; 
            margin-bottom: 1rem; 
            letter-spacing: -0.025em; 
        }
        .btn { 
            display: inline-block; 
            margin-top: 2rem; 
            padding: 1rem 2rem; 
            background: #10b981; 
            color: white; 
            text-decoration: none; 
            border-radius: 0.75rem; 
            font-weight: bold; 
            transition: transform 0.2s; 
        }
        .btn:active { transform: scale(0.95); }
        .loader { 
            border: 3px solid #f1f5f9; 
            border-top: 3px solid #10b981; 
            border-radius: 50%; 
            width: 40px; 
            height: 40px; 
            animation: spin 1s linear infinite; 
            margin: 1.5rem auto; 
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        p { color: #64748b; font-size: 0.95rem; line-height: 1.5; }
        .footer { margin-top: 2rem; font-size: 0.75rem; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo" style="margin-bottom: 4px; line-height: 1;">AuraGold</div>
        <div style="font-size: 0.7rem; font-weight: bold; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.18em; margin-bottom: 24px;">By Sanghavi Jewellers</div>
        <h2>Opening UPI App</h2>
        <div class="loader"></div>
        <p>Please wait while we securely redirect you to your payment application.</p>
        <a href="${intent}" class="btn">Pay Now</a>
        <div class="footer">Secure Payment via Setu UPI</div>
    </div>
    <script>
        // Attempt automatic redirect
        window.location.href = "${intent}";
    </script>
</body>
</html>`;
}
