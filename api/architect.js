
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
    if (!p) throw new Error("Path is required");
    const resolved = path.resolve(rootDir, p);
    if (!resolved.startsWith(rootDir)) throw new Error("Access Denied: Path Escape Detected");
    return resolved;
};

// --- COGNITIVE CRAWLER ---
const crawlAndIndex = async (dir, type = 'components') => {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            if (!['node_modules', '.git', 'dist', '.builds'].includes(file)) {
                results.push(...await crawlAndIndex(filePath, type));
            }
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const name = file.replace(/\.[^/.]+$/, "");
            const exports = [...content.matchAll(/export (const|function|class|interface|type|enum) (\w+)/g)].map(m => m[2]);
            const purposeMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
            const purpose = purposeMatch ? purposeMatch[1].replace(/\*/g, '').trim() : `Module: ${name}`;

            results.push({
                name,
                path: path.relative(rootDir, filePath),
                exports,
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
        if (rows.length > 0) res.json({ success: true, memory: rows[0].config });
        else res.json({ success: false, message: "Memory offline" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/index', async (req, res) => {
    try {
        const systemMap = {
            lastIndexed: new Date().toISOString(),
            components: await crawlAndIndex(path.join(rootDir, 'components')),
            services: await crawlAndIndex(path.join(rootDir, 'services')),
            apis: fs.existsSync(path.join(rootDir, 'api')) ? fs.readdirSync(path.join(rootDir, 'api')).filter(f => f.endsWith('.js')) : []
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
                } else if (['.ts', '.tsx', '.js', '.json', '.env'].includes(path.extname(file))) {
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

// --- SURGICAL INJECTION ---
router.post('/apply', (req, res) => {
    try {
        const { filePath, content } = req.body;
        if (!content || content.trim().length < 20) throw new Error("Payload too short for a valid code module.");

        const fullPath = safePath(filePath);
        let clean = content.trim();
        
        // Surgical Markdown Stripping: Only remove starting/ending marks, preserve internal ones
        if (clean.startsWith('```')) {
            clean = clean.replace(/^```[a-z]*\n/i, '').replace(/\n```$/m, '');
        }

        // Backup existing
        if (fs.existsSync(fullPath)) fs.copyFileSync(fullPath, `${fullPath}.bak`);
        
        fs.writeFileSync(fullPath, clean, 'utf-8');
        
        // Post-Write Check: Try to clear Node cache if it's an API file
        if (filePath.startsWith('api/')) {
            const resolved = path.resolve(fullPath);
            if (require && require.cache[resolved]) delete require.cache[resolved];
        }

        res.json({ success: true, message: "Architectural Injection Verified" });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/restore', (req, res) => {
    try {
        const fullPath = safePath(req.body.filePath);
        const bak = `${fullPath}.bak`;
        if (!fs.existsSync(bak)) throw new Error("No stable backup found.");
        fs.copyFileSync(bak, fullPath);
        res.json({ success: true, content: fs.readFileSync(fullPath, 'utf-8') });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/generate', async (req, res) => {
    const { prompt, filePath, contextFiles = [] } = req.body;
    const ai = getAI();
    if (!ai) return res.status(500).json({ error: "AI Gateway Key Missing" });

    try {
        const pool = getPool();
        const [mem] = await pool.query("SELECT config FROM integrations WHERE provider = 'system_memory'");
        const memory = mem.length ? JSON.parse(mem[0].config) : null;

        let targetContent = "";
        if (filePath && fs.existsSync(safePath(filePath))) {
            targetContent = fs.readFileSync(safePath(filePath), 'utf-8');
        }

        // Auto-Inject Types into Context
        const contextualPaths = Array.from(new Set(['types.ts', ...contextFiles]));
        let contextData = contextualPaths.map(p => {
            const sp = safePath(p);
            return fs.existsSync(sp) ? `\n--- FILE: ${p} ---\n${fs.readFileSync(sp, 'utf-8')}` : "";
        }).join('\n');

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `
            [ROLE: SUPREME ARCHITECT]
            Task: Transform the target module based on user directives. 
            
            [SYSTEM TOPOLOGY]
            ${memory ? JSON.stringify(memory, null, 2) : "Unknown"}

            [GLOBAL CONTEXT]
            ${contextData}

            [TARGET FILE: ${filePath || 'New'}]
            ${targetContent}

            [DIRECTIVE]
            ${prompt}

            [STRICT RULES]
            1. Return ONLY raw code content. 
            2. NO markdown delimiters (no \`\`\`).
            3. NO preamble, NO explanations.
            4. Ensure all imports match the System Topology.
            5. Use TypeScript.
            `,
            config: { thinkingConfig: { thinkingBudget: 8000 } }
        });

        let code = response.text || "";
        code = code.replace(/^```[a-z]*\n/i, '').replace(/\n```$/m, '');
        res.json({ success: true, content: code });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
