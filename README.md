
# 💎 AuraGold Order & Collection Manager

**AuraGold** is a high-end backend management system for Gold Jewellery Manufacturers and Sellers. It handles complex pricing, automated payment schedules, and AI-driven WhatsApp collection recovery.

---

## 🚀 GitHub Quick Start

### 1. Uploading to your GitHub Repository
If you haven't uploaded this to GitHub yet, use these commands in your local folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### 2. Automatic Deployment (GitHub Pages)
This project includes a GitHub Actions workflow. Every time you push to `main`, the site will automatically deploy.

1.  Go to your repository **Settings > Pages**.
2.  Set **Build and deployment > Source** to `GitHub Actions`.
3.  Add your Google AI Key to **Settings > Secrets and variables > Actions > Secrets** as `API_KEY`.

---

## 📦 Local Development

1.  **Clone the repo**: `git clone YOUR_REPO_URL`
2.  **Install**: `npm install`
3.  **Run**: `npm run dev`
4.  **Build**: `npm run build` (Output in `dist/` folder)

---

## 🌟 Core Modules

*   **Payment Architect**: Decoupled state management using custom React hooks.
*   **Gold Rate Protection**: Real-time market monitoring with automatic price adjustment for late payers.
*   **AI Recovery Engine**: Uses Gemini 2.5 Flash to analyze customer sentiment and suggest WhatsApp replies.
*   **System Health**: Built-in error monitoring and self-healing for WhatsApp templates.

---

## 🔧 Deployment to Hostinger (Manual)
If you prefer traditional hosting:
1.  Run `npm run build`.
2.  Upload the contents of the `dist/` folder to your `public_html` directory via File Manager or FTP.

---

*Built with React, Vite, Tailwind CSS, and Google Gemini AI.*
