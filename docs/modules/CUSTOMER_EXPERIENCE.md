
# 🧠 Memory Module: Customer Experience (CX)

## 🎯 Purpose
Manages customer data and provides the public-facing view where clients can track their orders and make payments.

## 🛠 Key Components
*   `components/CustomerList.tsx`: CRM directory with search and add functionality.
*   `components/CustomerProfile.tsx`: **NEW** - A unified dashboard for a single customer showing Lifetime Value (LTV) and Order History.
*   `components/CustomerOrderView.tsx`: The public "Track Order" page (accessed via Token).
*   `components/clusters/CommunicationWidget.tsx`: Integration of chat history.

## 🚀 Recent Improvements
1.  **Unified Customer Profile**: 
    *   Implemented a "One Customer -> Multiple Orders" architecture.
    *   **Aggregation Logic**: The system now dynamically groups orders by the customer's phone number (last 10 digits). This allows a single customer entry to reflect *all* past and current orders, calculating total spend (LTV) and outstanding dues across the board.
    *   **Visuals**: Added a rich profile header with LTV stats, "Last Active" date, and a consolidated list of orders.
2.  **Token-Based Security**: Orders are shared via a hash token (`shareToken`) instead of predictable IDs, ensuring privacy on public links.
3.  **Dynamic QR Generation**: `CustomerOrderView` now generates a dynamic UPI QR code specific to the outstanding balance.
4.  **Lazy Loading**: The Customer View is separated via code-splitting to ensure fast load times on mobile networks.

## 🔮 Future Roadmap
*   **Loyalty Program**: Track "Gold Points" for every purchase to encourage retention.
*   **KYC Locker**: Secure storage for customer PAN/Aadhar cards (required for high-value jewelry purchases in India).
*   **Feedback System**: Simple 5-star rating collection after "Delivered" status.
