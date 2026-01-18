
# 🧠 Memory Module: AI & Intelligence Services

## 🎯 Purpose
Leverages Google Gemini models to add "Brain" capabilities to the app: Risk Analysis, Message Generation, Error Diagnosis, and Strategy formulation.

## 🛠 Key Components
*   `services/geminiService.ts`: Wrapper for `@google/genai` SDK.
*   `components/NotificationCenter.tsx`: The "Strategy Console" that generates collection messages.
*   `components/ErrorLogPanel.tsx`: AI-driven system health dashboard.

## 🚀 Recent Improvements
1.  **Error Self-Diagnosis**: Implemented logic where application errors are sent to Gemini to generate a "Fix Path" (e.g., "Check API Key", "Edit Template").
2.  **Strategic Nudging**: The `NotificationCenter` now uses AI to decide whether to send a WhatsApp message or SMS based on customer "Risk Profile".
3.  **Chat Insight**: Added analysis of chat history to suggest the "Next Best Action" or reply draft for sales agents.

## 🔮 Future Roadmap
*   **Visual Search**: Allow uploading a photo of a jewelry design to find similar items in the catalog (using Gemini Vision).
*   **Voice Commands**: "Hey Aura, create an order for Ananya" (Speech-to-Text -> Function Calling).
*   **Predictive Stock**: Analyze order trends to recommend which gold purity/items to stock up on.
