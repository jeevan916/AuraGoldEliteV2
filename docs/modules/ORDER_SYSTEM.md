
# 🧠 Memory Module: Order Management System

## 🎯 Purpose
Manages the entire lifecycle of a jewelry order, from initial booking and gold rate locking to production tracking and final handover. It acts as the "Legal Contract" engine.

## 🛠 Key Components
*   `components/OrderForm.tsx`: Complex multi-step wizard for creating orders with "Gold Rate Protection".
*   `components/OrderDetails.tsx`: The main dashboard for a specific order, handling status changes and lapse logic.
*   `components/OrderBook.tsx`: Registry view with filtering and archiving.
*   `hooks/useOrders.ts`: State management hook.
*   `services/pdfGenerator.ts`: Generates legal PDF contracts.

## 🚀 Recent Improvements
1.  **Lapse & Repopulate Logic**: Added sophisticated logic to handle "Gold Rate Protection Lapse". If a customer defaults, admins can now "Repopulate" the order at current market rates, automatically recalculating all line items and payment milestones.
2.  **Plug & Play Widgets**: Refactored `OrderDetails` to use `PaymentWidget` and `CommunicationWidget` as reusable clusters.
3.  **Visual Status**: Added clear UI indicators for "Rate Protected" vs "Revoked" states.
4.  **Archive Flow**: Implemented a strict "Handover" process that locks the order and moves it to the archive only when fully paid.

## 🔮 Future Roadmap
*   **Barcode/QR Scanning**: Implement camera scanning in `OrderForm` to instantly add catalog items via physical tags.
*   **Karigar (Worker) Portal**: A restricted view for manufacturing staff to update `ProductionStatus` (e.g., "Casting", "Polishing") without seeing financial data.
*   **Digital Signatures**: Integration with a service like DocuSign or simple canvas signature pad for customer sign-off on the tablet.
