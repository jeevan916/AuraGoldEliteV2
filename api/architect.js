
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = process.cwd();

const router = express.Router();

const getAI = () => {
    const key = process.env.API_KEY;
    if (!key) return null;
    return new GoogleGenAI({ apiKey: key });
};

// Security Helper: Ensure path is within project root
const safePath = (p) => {
    const resolved = path.resolve(rootDir, p);
    if (!resolved.startsWith(rootDir)) throw new Error("Access Denied: Path Escape Detected");
    return resolved;
};

// Recursively get all editable files
const getFiles = (dir, fileList = []) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                getFiles(filePath, fileList);
            }
        } else {
            const ext = path.extname(file);
            if (['.ts', '.tsx', '.js', '.json', '.css', '.html'].includes(ext)) {
                fileList.push({
                    path: path.relative(rootDir, filePath),
                    lastModified: stats.mtime
                });
            }
        }
    });
    return fileList;
};

router.get('/files', (req, res) => {
    try {
        const files = getFiles(rootDir);
        res.json({ success: true, files });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/read', (req, res) => {
    const { filePath } = req.body;
    try {
        const fullPath = safePath(filePath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        res.json({ success: true, content });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/apply', (req, res) => {
    const { filePath, content, commitMessage } = req.body;
    try {
        const fullPath = safePath(filePath);
        
        // Backup before overwrite
        if (fs.existsSync(fullPath)) {
            const backupPath = `${fullPath}.bak`;
            fs.copyFileSync(fullPath, backupPath);
        }

        fs.writeFileSync(fullPath, content, 'utf-8');
        
        console.log(`[Architect] Code Injection Applied to ${filePath}: ${commitMessage}`);
        res.json({ success: true, message: `Successfully updated ${filePath}` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

router.post('/generate', async (req, res) => {
    const { prompt, filePath, contextFiles } = req.body;
    const ai = getAI();
    if (!ai) return res.status(500).json({ error: "AI Service Not Configured" });

    try {
        let fileContent = "";
        if (filePath) {
            fileContent = fs.readFileSync(safePath(filePath), 'utf-8');
        }

        let contextData = "";
        if (contextFiles && Array.isArray(contextFiles)) {
            contextFiles.forEach(f => {
                const content = fs.readFileSync(safePath(f), 'utf-8');
                contextData += `\n--- FILE: ${f} ---\n${content}\n`;
            });
        }

        const model = 'gemini-3-pro-preview';
        const response = await ai.models.generateContent({
            model,
            contents: `
            [SYSTEM ROLE]
            You are the "Architect God Mode" for the AuraGold Elite app.
            Your task is to provide the FULL content of a file after applying the requested changes.
            
            [CONTEXT FILES]
            ${contextData}

            [TARGET FILE: ${filePath || 'New File'}]
            ${fileContent}

            [USER REQUEST]
            ${prompt}

            [INSTRUCTIONS]
            - Return ONLY the full content of the updated file.
            - Do not include markdown code blocks like \`\`\`tsx unless they are part of the actual file content.
            - Ensure high-quality, bug-free implementation.
            - Use the types and patterns found in the context files.
            `,
            config: {
                thinkingConfig: { thinkingBudget: 4000 }
            }
        });

        res.json({ success: true, content: response.text });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
