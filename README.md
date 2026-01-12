
# 💎 AuraGold Elite - System Architecture & Protocol

**Version:** 3.1.0 (iOS Mobile-First Build)  
**Stack:** React 19, Vite, Tailwind CSS, Google GenAI SDK (Gemini 2.0/1.5), Meta WhatsApp API.

---

## 🛑 CORE PROTOCOLS (DO NOT MODIFY WITHOUT REVIEW)

### 1. Mobile-First Design Language (iOS)
*   **Viewport:** Must use `viewport-fit=cover` to handle iPhone notches.
*   **Input Handling:** All inputs must have `font-size: 16px` to prevent iOS Safari from zooming in on focus.
*   **Navigation:** 
    *   **Mobile (<1024px):** Uses `Glassmorphic Bottom Tab Bar`.
    *   **Desktop (>=1024px):** Uses `Side Navigation Sidebar`.
*   **Typography:** Usage of `Inter` for UI and `Playfair Display` for "Elite" branding.

### 2. Pricing Engine Logic (`OrderForm.tsx`)
The price calculation is **sacrosanct**. Do not alter the order of operations:
1.  **Metal Value** = Net Weight × Purity Rate (24K/22K/18K).
2.  **Wastage (VA)** = Metal Value × Percentage.
3.  **Labor (Making)** = Rate per gram × Net Weight.
4.  **Stone Charges** = Flat fee added.
5.  **Subtotal** = Metal + Wastage + Labor + Stone.
6.  **Final Total** = Subtotal + GST (default 3%).

### 3. Gold Rate Protection Logic (`OrderDetails.tsx`)
*   **Active:** Customer pays booked rate (`protectionRateBooked`).
*   **Warning:** Milestone is unpaid, but within grace period.
*   **Lapsed:** If `protectionStatus === 'LAPSED'`, the system **must** calculate using the *Current Market Rate* instead of the booked rate.

---

## 🧠 AI & Automation Modules

### 1. Gemini AI Service (`geminiService.ts`)
*   **Model Usage:** 
    *   `gemini-3-flash-preview`: For high-speed tasks (Notifications, Chat analysis).
    *   `gemini-3-pro-preview`: For complex reasoning (Risk Analysis, System Diagnosis).
*   **JSON Enforcement:** All prompts use `responseMimeType: "application/json"` to ensure type safety.

### 2. WhatsApp Engine (`whatsappService.ts`)
*   **Template Healing:** If a template send fails due to "does not exist", the system attempts to auto-create it using `REQUIRED_SYSTEM_TEMPLATES` definitions.
*   **Versioning:** The system automatically appends `_v2`, `_v3` if a template name collision occurs on Meta.
*   **Proxy:** Uses `services/proxyService.ts` to fetch Gold Rates and Market Intel to bypass CORS.

---

## 📂 Directory Structure & Context

*   `src/components/`
    *   `OrderForm.tsx`: Multi-step wizard (Items -> Customer -> Plan). Handles image compression.
    *   `OrderDetails.tsx`: The ledger view. Handles logic for "Payment vs Balance" and "Rate Protection" status.
    *   `WhatsAppTemplates.tsx`: The AI factory for generating Meta-compliant templates.
    *   `ErrorLogPanel.tsx`: The self-healing diagnostic center.
*   `src/services/`
    *   `goldRateService.ts`: Fetches live rates (Augmont/Kitco) via proxy. Caches to localStorage for 4 hours.
    *   `imageOptimizer.ts`: Compresses uploads to max 1200px width/height (0.75 quality) to save storage.

---

## 🔄 Version History & Changelog

### v3.1.0 - iOS Mobile Refactor (Current)
*   **UI Overhaul:** Implemented Apple Health-style horizontal snap scrolling for Dashboard stats.
*   **Navigation:** Replaced hamburger menu with Bottom Tab Bar (Glassmorphism).
*   **UX:** Added Haptic Feedback visual cues and Native Sheet-style modals.
*   **Fix:** Inputs set to 16px to fix iOS zoom bug.

### v3.0.0 - The AI Core
*   **Gemini Integration:** Replaced hardcoded logic with `geminiService` for risk analysis.
*   **Auto-Heal:** Added `errorService` that uses AI to diagnose and fix template errors.
*   **WhatsApp Hub:** Centralized chat view with outbound/inbound simulation.

### v2.0.0 - Financial Engine
*   **Payment Plans:** Added logic for Interest %, Advance %, and Gold Rate Protection.
*   **PDF Generation:** Added `jspdf` for contract generation.

---

## 🛠 Setup & Environment

1.  **Environment Variables:**
    Ensure `.env` exists with `VITE_API_KEY` (Gemini).
    
2.  **Permissions:**
    `metadata.json` requests Camera/Microphone for future video-KYC features.

3.  **Local Storage Keys:**
    *   `aura_orders`: Main database.
    *   `aura_settings`: App config (Rates, Meta Keys).
    *   `aura_gold_rate_cache`: Time-stamped market data.

---

## ⚠️ Maintenance Notes for AI Agent
*   **Context:** When modifying `PaymentCollections.tsx`, remember to verify logic against `activeTab` ('OVERDUE' vs 'UPCOMING').
*   **Rate Limits:** The `goldRateService` has a fallback to LocalStorage. Do not remove the `try/catch` block around the Proxy fetch.
*   **Meta API:** Template creation is brittle. Ensure `variableExamples` are always sent in the payload.
