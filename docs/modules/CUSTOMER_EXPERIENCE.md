
# 🧠 Memory Module: Customer Experience (CX)

## 🎯 Purpose
Manages customer data and provides the public-facing view where clients can track their orders and make payments.

## 🛠 Key Components
*   `components/CustomerList.tsx`: CRM directory.
*   `components/CustomerOrderView.tsx`: The public "Track Order" page (accessed via Token).
*   `components/clusters/CommunicationWidget.tsx`: Integration of chat history.

## 🚀 Recent Improvements
1.  **Token-Based Security**: Orders are shared via a hash token (`shareToken`) instead of predictable IDs, ensuring privacy on public links.
2.  **Dynamic QR Generation**: `CustomerOrderView` now generates a dynamic UPI QR code specific to the outstanding balance.
3.  **Lazy Loading**: The Customer View is separated via code-splitting to ensure fast load times on mobile networks.

## 🔮 Future Roadmap
*   **Loyalty Program**: Track "Gold Points" for every purchase to encourage retention.
*   **KYC Locker**: Secure storage for customer PAN/Aadhar cards (required for high-value jewelry purchases in India).
*   **Feedback System**: Simple 5-star rating collection after "Delivered" status.
