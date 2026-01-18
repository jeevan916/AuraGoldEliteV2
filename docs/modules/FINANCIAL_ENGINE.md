
# 🧠 Memory Module: Financial & Collection Engine

## 🎯 Purpose
The core revenue assurance system. It tracks payments against milestones, calculates overdue balances, interacts with payment gateways, and manages installment schemes.

## 🛠 Key Components
*   `components/PaymentCollections.tsx`: The "Accounts Department" view. Global list of dues.
*   `components/clusters/PaymentWidget.tsx`: Reusable component for recording payments (Cash/UPI/Gateway).
*   `components/PlanManager.tsx`: Configuration for EMI schemes (Interest/Advance).
*   `services/goldRateService.ts`: Fetches live bullion rates.

## 🚀 Recent Improvements
1.  **Razorpay & Setu Integration**: Added direct API calls in `server.js` (proxied) to create Razorpay orders and generate Setu UPI deeplinks.
2.  **Compact vs Full Modes**: Created a "Compact" mode for `PaymentWidget` to be used in the Dashboard for quick actions.
3.  **Milestone Flattening**: Optimized `PaymentCollections` to flatten nested order milestones into a single sortable list for efficient debt recovery.
4.  **AI Recovery Strategy**: Linked Gemini AI to suggest collection tones (Polite/Firm/Urgent) based on overdue duration.

## 🔮 Future Roadmap
*   **Bank Reconciliation**: Upload bank statements (CSV) to auto-match payments with orders.
*   **eNACH / Autopay**: Integration for recurring auto-debits via Razorpay Subscriptions.
*   **Dynamic Interest**: Logic to automatically apply late fees if payment is >7 days overdue (configurable).
