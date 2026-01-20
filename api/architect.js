
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
            if (!['node_modules', '.git', 'dist'].includes(file)) {
                results.push(...await crawlAndIndex(filePath, type));
            }
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const name = file.replace(/\.[^/.]+$/, "");
            const commentMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
            const purpose = commentMatch ? commentMatch[1].replace(/\*/g, '').trim() : "Undocumented Module";
            const exports = [...content.matchAll(/export (const|function|class|interface|type|enum) (\w+)/g)].map(m => m[2]);
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
    try {
        const compDir = path.join(rootDir, 'components');
        const servDir = path.join(rootDir, 'services');
        const apiDir = path.join(rootDir, 'api');

        const components = await crawlAndIndex(compDir, 'components');
        const services = await crawlAndIndex(servDir, 'services');
        const apis = fs.existsSync(apiDir) ? fs.readdirSync(apiDir).filter(f => f.endsWith('.js')) : [];

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
            if (!fs.existsSync(dir)) return fileList;
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    if (!['node_modules', '.git', 'dist', '.builds'].includes(file)) getFileList(filePath, fileList);
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

// --- ENHANCED INJECTION WITH SANITIZATION ---
router.post('/apply', (req, res) => {
    try {
        const { filePath, content } = req.body;
        if (!content || content.length < 10) throw new Error("Refusing to save likely corrupted or empty file.");

        const fullPath = safePath(filePath);
        
        // Sanitize: Strip Markdown wrappers if AI ignored instructions
        let cleanContent = content;
        if (cleanContent.includes('```')) {
            const match = cleanContent.match(/```(?:[a-z]*)\n([\s\S]*?)\n```/);
            if (match && match[1]) {
                cleanContent = match[1];
            } else {
                // Fallback: just strip the marks if regex fails
                cleanContent = cleanContent.replace(/```[a-z]*\n?/gi, '').replace(/\n?```/gi, '');
            }
        }

        // Create backup
        if (fs.existsSync(fullPath)) fs.copyFileSync(fullPath, `${fullPath}.bak`);
        
        fs.writeFileSync(fullPath, cleanContent, 'utf-8');
        res.json({ success: true, message: "Injection Applied Successfully" });
    } catch (e) { 
        res.status(500).json({ success: false, error: e.message }); 
    }
});

// --- RESTORE BACKUP ---
router.post('/restore', (req, res) => {
    try {
        const { filePath } = req.body;
        const fullPath = safePath(filePath);
        const bakPath = `${fullPath}.bak`;

        if (!fs.existsSync(bakPath)) throw new Error("No backup file found for this module.");

        fs.copyFileSync(bakPath, fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        res.json({ success: true, content, message: "Restored from last stable version." });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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
                const p = safePath(f);
                if (fs.existsSync(p)) {
                    contextData += `\n--- FILE: ${f} ---\n${fs.readFileSync(p, 'utf-8')}\n`;
                }
            });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `
            [SYSTEM SENTIENCE ROLE]
            You are the "Architect God Mode" for the AuraGold Elite app.
            You must provide the FULL updated content of the target file.
            
            [SYSTEM DISCOVERY MAP]
            ${systemMemory ? JSON.stringify(systemMemory, null, 2) : "System map not indexed."}

            [CONTEXT]
            ${contextData}

            [TARGET: ${filePath || 'New File'}]
            ${fileContent}

            [USER REQUEST]
            ${prompt}

            [CRITICAL INSTRUCTIONS]
            - Return ONLY raw code content. 
            - NO markdown wrappers (no \`\`\` tags).
            - DO NOT explain your changes.
            - Ensure syntax is valid TypeScript/JavaScript.
            `,
            config: { thinkingConfig: { thinkingBudget: 5000 } }
        });

        let resultText = response.text || "";
        // Pre-strip just in case it arrived with wrappers
        resultText = resultText.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '');

        res.json({ success: true, content: resultText });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
