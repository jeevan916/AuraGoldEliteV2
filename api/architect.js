
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import { getPool } from './db.js';

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
    if (!p) throw new Error("Path is required");
    const resolved = path.resolve(rootDir, p);
    if (!resolved.startsWith(rootDir)) throw new Error("Access Denied: Path Escape Detected");
    return resolved;
};

const crawlAndIndex = async (dir) => {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            if (!['node_modules', '.git', 'dist'].includes(file)) {
                results.push(...await crawlAndIndex(filePath));
            }
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            results.push({
                name: file.replace(/\.[^/.]+$/, ""),
                path: path.relative(rootDir, filePath),
                exports: [...content.matchAll(/export (const|function|class|interface|type) (\w+)/g)].map(m => m[2]),
                purpose: `Module: ${file}`
            });
        }
    }
    return results;
};

router.get('/memory', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.query("SELECT config FROM integrations WHERE provider = 'system_memory'");
        if (rows.length > 0) res.json({ success: true, memory: JSON.parse(rows[0].config) });
        else res.json({ success: false, message: "Memory offline" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/index', async (req, res) => {
    try {
        const systemMap = {
            lastIndexed: new Date().toISOString(),
            components: await crawlAndIndex(path.join(rootDir, 'components')),
            services: await crawlAndIndex(path.join(rootDir, 'services')),
            apis: fs.existsSync(path.join(rootDir, 'api')) ? fs.readdirSync(path.join(rootDir, 'api')) : []
        };
        const pool = getPool();
        await pool.query("INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)", ['system_memory', JSON.stringify(systemMap)]);
        res.json({ success: true, memory: systemMap });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/files', (req, res) => {
    try {
        const getFileList = (dir, list = []) => {
            fs.readdirSync(dir).forEach(file => {
                const fp = path.join(dir, file);
                const stats = fs.statSync(fp);
                if (stats.isDirectory()) {
                    if (!['node_modules', '.git', 'dist'].includes(file)) getFileList(fp, list);
                } else if (['.ts', '.tsx', '.js', '.json'].includes(path.extname(file))) {
                    list.push({ path: path.relative(rootDir, fp), lastModified: stats.mtime });
                }
            });
            return list;
        };
        res.json({ success: true, files: getFileList(rootDir) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/read', (req, res) => {
    try { res.json({ success: true, content: fs.readFileSync(safePath(req.body.filePath), 'utf-8') }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/apply', (req, res) => {
    try {
        const { filePath, content } = req.body;
        const fullPath = safePath(filePath);
        let clean = content.trim();
        if (clean.startsWith('```')) {
            clean = clean.replace(/^```[a-z]*\n/i, '').replace(/\n```$/m, '');
        }
        if (fs.existsSync(fullPath)) fs.copyFileSync(fullPath, `${fullPath}.bak`);
        fs.writeFileSync(fullPath, clean, 'utf-8');
        res.json({ success: true, message: "Injection Success" });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/generate', async (req, res) => {
    const { prompt, filePath } = req.body;
    const ai = getAI();
    if (!ai) return res.status(500).json({ error: "AI Key Missing" });

    try {
        let targetContent = "";
        if (filePath && fs.existsSync(safePath(filePath))) {
            targetContent = fs.readFileSync(safePath(filePath), 'utf-8');
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Transform this file: ${filePath}\nOriginal Content:\n${targetContent}\n\nDirective: ${prompt}\n\nRules: Return raw code only. No markdown.`,
            config: { thinkingConfig: { thinkingBudget: 4000 } }
        });
        res.json({ success: true, content: response.text });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
