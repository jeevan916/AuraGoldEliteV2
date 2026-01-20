
import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
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

const safePath = (p) => {
    const resolved = path.resolve(rootDir, p);
    if (!resolved.startsWith(rootDir)) throw new Error("Access Denied: Path Escape Detected");
    return resolved;
};

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
            if (['.ts', '.tsx', '.js', '.json', '.css', '.html', '.php', '.env', '.htaccess'].includes(ext)) {
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
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        if (fs.existsSync(fullPath)) {
            const backupPath = `${fullPath}.bak`;
            fs.copyFileSync(fullPath, backupPath);
        }

        fs.writeFileSync(fullPath, content, 'utf-8');
        res.json({ success: true, message: `Successfully updated ${filePath}` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * DEVOPS ENDPOINTS
 */

router.get('/git-status', (req, res) => {
    exec('git status -s && git branch --show-current', { cwd: rootDir }, (error, stdout) => {
        if (error) return res.json({ success: false, error: "Not a git repository or git not installed" });
        const lines = stdout.trim().split('\n');
        const branch = lines.pop();
        res.json({ success: true, branch, changes: lines });
    });
});

router.post('/terminal', (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: "No command" });
    
    exec(command, { cwd: rootDir, timeout: 60000 }, (error, stdout, stderr) => {
        res.json({
            success: !error,
            output: stdout,
            error: stderr || (error ? error.message : null)
        });
    });
});

router.post('/generate', async (req, res) => {
    const { prompt, filePath, contextFiles } = req.body;
    const ai = getAI();
    if (!ai) return res.status(500).json({ error: "AI Service Not Configured" });

    try {
        let fileContent = "";
        if (filePath && fs.existsSync(safePath(filePath))) {
            fileContent = fs.readFileSync(safePath(filePath), 'utf-8');
        }

        let contextData = "";
        if (contextFiles && Array.isArray(contextFiles)) {
            contextFiles.forEach(f => {
                if (fs.existsSync(safePath(f))) {
                    const content = fs.readFileSync(safePath(f), 'utf-8');
                    contextData += `\n--- FILE: ${f} ---\n${content}\n`;
                }
            });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
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
            - Do not include markdown code blocks.
            - Ensure high-quality, bug-free implementation.
            `,
            config: { thinkingConfig: { thinkingBudget: 4000 } }
        });

        res.json({ success: true, content: response.text });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
