
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool, ensureDb, logDbActivity, isMock } from './db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'auragold_elite_secret_key_2025';

// Middleware to verify Admin JWT
const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'ADMIN') {
            return res.status(403).json({ success: false, error: 'Requires Admin role' });
        }
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
};

// Login Endpoint
router.post('/auth/login', ensureDb, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    try {
        const envAdmin = process.env.APP_ADMIN || 'admin';
        const envPass = process.env.APP_PASSWORD;

        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM app_users WHERE username = ? OR username = ?', [username, envAdmin]);
        connection.release();

        let user = rows.find(r => r.username === username) || rows[0];

        // If user record not found in DB but matches process.env.APP_ADMIN or 'admin'
        if (!user && (username === envAdmin || username === 'admin')) {
            user = { id: 1, username: username, role: 'ADMIN', password_hash: '' };
        }

        if (!user) {
            await logDbActivity('LOGIN_FAILED', `Unknown user: ${username}`, { username }, req);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        let isMatch = false;

        // 1. Direct environment variable check if configured
        if (envPass && username === envAdmin && password === envPass) {
            isMatch = true;
        }

        // 2. Standard bcrypt password comparison
        if (!isMatch && user.password_hash) {
            isMatch = await bcrypt.compare(password, user.password_hash);
        }

        if (!isMatch) {
            await logDbActivity('LOGIN_FAILED', `Wrong password for ${username}`, { username }, req);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id || 1, username: user.username, role: user.role || 'ADMIN' },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        await logDbActivity('LOGIN_SUCCESS', `User ${username} logged in`, { role: user.role || 'ADMIN' }, req);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                token
            }
        });

    } catch (e) {
        console.error("Login Error:", e);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Create User (Admin Only - simplified for initial setup, normally requires auth middleware)
router.post('/auth/register', ensureDb, async (req, res) => {
    const { username, password, role, mobile_number, adminSecret } = req.body;

    // Support both process.env.ADMIN_SECRET (if explicitly configured) and JWT token (for UI)
    let isAuthorized = false;
    if (process.env.ADMIN_SECRET && adminSecret === process.env.ADMIN_SECRET) {
        isAuthorized = true;
    } else {
        const authHeader = req.headers.authorization;
        if (authHeader) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, JWT_SECRET);
                if (decoded.role === 'ADMIN') isAuthorized = true;
            } catch (e) {}
        }
    }

    if (!isAuthorized) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    if (!['ADMIN', 'MANAGER', 'SALES', 'KARIGAR'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid Role' });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        
        // check if exists
        const [existing] = await connection.query("SELECT id FROM app_users WHERE username = ?", [username]);
        if (existing.length > 0) {
             connection.release();
             return res.status(400).json({ success: false, error: 'Username already exists' });
        }

        const hash = await bcrypt.hash(password, 10);
        
        await connection.query(
            "INSERT INTO app_users (username, password_hash, role, mobile_number) VALUES (?, ?, ?, ?)",
            [username, hash, role, mobile_number || '']
        );
        
        connection.release();
        res.json({ success: true, message: `User ${username} created as ${role}` });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Get all users
router.get('/auth/users', ensureDb, verifyAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT id, username, role, mobile_number, created_at FROM app_users ORDER BY created_at DESC');
        connection.release();
        res.json({ success: true, users: rows });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Unified route to update staff member details (role, mobile_number, and password if provided)
router.put('/auth/users/:id', ensureDb, verifyAdmin, async (req, res) => {
    const { role, mobile_number, password } = req.body;
    
    if (role && !['ADMIN', 'MANAGER', 'SALES', 'KARIGAR'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid Role' });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        
        if (password && password.trim().length >= 4) {
            const hash = await bcrypt.hash(password, 10);
            await connection.query(
                "UPDATE app_users SET role = ?, mobile_number = ?, password_hash = ? WHERE id = ?",
                [role, mobile_number || '', hash, req.params.id]
            );
        } else {
            await connection.query(
                "UPDATE app_users SET role = ?, mobile_number = ? WHERE id = ?",
                [role, mobile_number || '', req.params.id]
            );
        }
        
        connection.release();
        res.json({ success: true, message: 'User updated successfully' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Update user role
router.put('/auth/users/:id/role', ensureDb, verifyAdmin, async (req, res) => {
    const { role } = req.body;
    if (!['ADMIN', 'MANAGER', 'SALES', 'KARIGAR'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid Role' });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        await connection.query("UPDATE app_users SET role = ? WHERE id = ?", [role, req.params.id]);
        connection.release();
        res.json({ success: true, message: 'Role updated' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Update user password
router.put('/auth/users/:id/password', ensureDb, verifyAdmin, async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 4) {
        return res.status(400).json({ success: false, error: 'Password too short' });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const hash = await bcrypt.hash(password, 10);
        await connection.query("UPDATE app_users SET password_hash = ? WHERE id = ?", [hash, req.params.id]);
        connection.release();
        res.json({ success: true, message: 'Password updated' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Delete user
router.delete('/auth/users/:id', ensureDb, verifyAdmin, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        
        // Prevent deleting oneself
        if (parseInt(req.params.id) === parseInt(req.user.id)) {
             connection.release();
             return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
        }
        
        await connection.query("DELETE FROM app_users WHERE id = ?", [req.params.id]);
        connection.release();
        res.json({ success: true, message: 'User deleted' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

export default router;
