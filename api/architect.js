
import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
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
    const resolved = path.resolve(rootDir, p);
    if (!resolved.startsWith(rootDir)) throw new Error("Access Denied: Path Escape Detected");
    return resolved;
};

// --- COGNITIVE CRAWLER ---
const crawlAndIndex = async (dir, type = 'components') => {
    const results = [];
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            results.push(...await crawlAndIndex(filePath, type));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Extract component/service name
            const name = file.replace(/\.[^/.]+$/, "");
            
            // AI-ready purpose extraction (Simple regex for comments)
            const commentMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
            const purpose = commentMatch ? commentMatch[1].replace(/\*/g, '').trim() : "Undocumented Module";

            // Identify exports
            const exports = [...content.matchAll(/export (const|function|class|interface|type|enum) (\w+)/g)].map(m => m[2]);
            
            // Identify imports (Dependencies)
            const dependencies = [...content.matchAll(/import .* from ['"](.*)['"]/g)].map(m => m[1]);

            results.push({
                name,
                path: path.relative(rootDir, filePath),
                exports,
                dependencies,
                purpose
            });
        }
    }
    return results;
};

router.get('/memory', async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.query("SELECT config FROM integrations WHERE provider = 'system_memory'");
        if (rows.length > 0) {
            res.json({ success: true, memory: rows[0].config });
        } else {
            res.json({ success: false, message: "Memory not yet indexed" });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/index', async (req, res) => {
    console.log("[Architect] Running Cognitive Re-Indexing...");
    try {
        const components = await crawlAndIndex(path.join(rootDir, 'components'), 'components');
        const services = await crawlAndIndex(path.join(rootDir, 'services'), 'services');
        const apis = fs.readdirSync(path.join(rootDir, 'api')).filter(f => f.endsWith('.js'));

        const systemMap = {
            lastIndexed: new Date().toISOString(),
            components,
            services,
            apis
        };

        const pool = getPool();
        await pool.query(
            "INSERT INTO integrations (provider, config) VALUES (?, ?) ON DUPLICATE KEY UPDATE config=VALUES(config)",
            ['system_memory', JSON.stringify(systemMap)]
        );

        res.json({ success: true, memory: systemMap });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/files', (req, res) => {
    try {
        const getFileList = (dir, fileList = []) => {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    if (!['node_modules', '.git', 'dist'].includes(file)) getFileList(filePath, fileList);
                } else if (['.ts', '.tsx', '.js', '.json', '.css', '.html', '.env'].includes(path.extname(file))) {
                    fileList.push({ path: path.relative(rootDir, filePath), lastModified: stats.mtime });
                }
            });
            return fileList;
        };
        res.json({ success: true, files: getFileList(rootDir) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/read', (req, res) => {
    try {
        const content = fs.readFileSync(safePath(req.body.filePath), 'utf-8');
        res.json({ success: true, content });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/apply', (req, res) => {
    try {
        const fullPath = safePath(req.body.filePath);
        if (fs.existsSync(fullPath)) fs.copyFileSync(fullPath, `${fullPath}.bak`);
        fs.writeFileSync(fullPath, req.body.content, 'utf-8');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/terminal', (req, res) => {
    exec(req.body.command, { cwd: rootDir, timeout: 60000 }, (error, stdout, stderr) => {
        res.json({ success: !error, output: stdout, error: stderr || (error ? error.message : null) });
    });
});

router.post('/generate', async (req, res) => {
    const { prompt, filePath, contextFiles } = req.body;
    const ai = getAI();
    if (!ai) return res.status(500).json({ error: "AI Not Configured" });

    try {
        // --- INJECT SYSTEM MEMORY INTO AI PROMPT ---
        const pool = getPool();
        const [memRows] = await pool.query("SELECT config FROM integrations WHERE provider = 'system_memory'");
        const systemMemory = memRows.length > 0 ? JSON.parse(memRows[0].config) : null;

        let fileContent = "";
        if (filePath && fs.existsSync(safePath(filePath))) {
            fileContent = fs.readFileSync(safePath(filePath), 'utf-8');
        }

        let contextData = "";
        if (contextFiles && Array.isArray(contextFiles)) {
            contextFiles.forEach(f => {
                if (fs.existsSync(safePath(f))) {
                    contextData += `\n--- FILE: ${f} ---\n${fs.readFileSync(safePath(f), 'utf-8')}\n`;
                }
            });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `
            [SYSTEM SENTIENCE ROLE]
            You are the "Architect God Mode" for the AuraGold Elite app.
            You must provide the FULL updated content of the target file.
            
            [SYSTEM DISCOVERY MAP (The App's Memory)]
            ${systemMemory ? JSON.stringify(systemMemory, null, 2) : "System map not yet indexed. Proceed with available file context."}

            [CONTEXT FILES]
            ${contextData}

            [TARGET FILE: ${filePath || 'New File'}]
            ${fileContent}

            [USER REQUEST]
            ${prompt}

            [MANDATORY INSTRUCTIONS]
            - Return ONLY raw file content. No markdown wrappers.
            - Respect existing types and patterns found in the System Discovery Map.
            - Ensure enterprise-grade logic.
            `,
            config: { thinkingConfig: { thinkingBudget: 5000 } }
        });

        res.json({ success: true, content: response.text });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
