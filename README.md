# 💎 AuraGold Elite - Authoritative Specification

**Version:** 3.5.0 (Express/MySQL Edition)
**Stack:** React 19, Express, Node 22.x, MySQL, Gemini AI.

## 1. Project Purpose
AuraGold Elite is a luxury-grade jewelry management system designed for gold retailers to handle complex order valuations, installment plans, and AI-driven debt recovery.

## 2. Technical Architecture
- **Frontend**: React 19 with Tailwind CSS.
- **Backend**: Express server (`server.ts`) handling API and static assets.
- **Database**: MySQL table `app_storage` storing a single JSON blob of the entire application state for perfect synchronization.
- **AI**: Gemini 3 Pro/Flash for risk analysis, message generation, and system diagnosis.

## 3. Core Business Logic
- **Valuation**: `Total = ((NetWt * Rate) * (1 + VA%)) + Labor + Stones + GST`.
- **Gold Rate Protection**: Locked rate feature that voids upon payment default (7-day grace period).
- **Communication**: WhatsApp Business API using AI-optimized psychological tactics (Loss Aversion, Social Proof, Urgency).

## 4. Design Standards (AuraDesign)
- **Aesthetic**: iOS-inspired Glassmorphism.
- **Colors**: Slate-900 (Base), Amber-600 (Gold Accent), f2f2f7 (Surface).
- **UX**: Bottom Tab Bar (Mobile), Sidebar (Desktop), High-radius cards (24px).

## 5. Deployment (Hostinger Node.js)
- **Root Directory**: `./`
- **Node Version**: 22.x
- **Framework**: Express
- **Build Command**: `npm run build`
- **Start Command**: `npm start` (runs `node server.js` which is the compiled version of `server.ts`)

---
*This specification is the source of truth for all AuraGold Elite development.*
