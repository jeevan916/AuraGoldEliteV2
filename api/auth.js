
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getPool, ensureDb, logDbActivity, isMock } from './db.js';

const router = express.Router();
export const JWT_SECRET = process.env.JWT_SECRET || 'auragold_jwt_secure_master_secret_2026_prod_v2';

// ---------------------------------------------------------
// REUSABLE AUTHENTICATION & IDOR PROTECTION MIDDLEWARE
// ---------------------------------------------------------

/**
 * Standard JWT Authentication Middleware
 * Extracts token from Authorization header or query param.
 */
export const authenticateToken = (req, res, next) => {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query && req.query.auth_token) {
        token = req.query.auth_token;
    }

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            error: 'Authentication required. No session or token provided.' 
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid or expired session token.' 
        });
    }
};

/**
 * Optional Authentication Middleware
 * Populates req.user if a valid token is provided, without failing if missing.
 */
export const optionalAuth = (req, res, next) => {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query && req.query.auth_token) {
        token = req.query.auth_token;
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (e) {}
    }
    next();
};

/**
 * Role-Based Access Control (RBAC)
 * @param  {...string} allowedRoles Allowed roles for the endpoint (ADMIN always allowed)
 */
export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (req.user.role === 'ADMIN' || allowedRoles.includes(req.user.role)) {
            return next();
        }
        return res.status(403).json({ 
            success: false, 
            error: `Access Denied. Required roles: ${allowedRoles.join(', ')} (Your role: ${req.user.role})` 
        });
    };
};

/**
 * Enforce Admin Role
 */
export const verifyAdmin = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user && req.user.role === 'ADMIN') {
            return next();
        }
        return res.status(403).json({ success: false, error: 'Access Denied. Administrator privileges required.' });
    });
};

/**
 * IDOR / Object-Level Authorization Protection
 * Verifies that the currently logged-in user is either accessing their own resource
 * (where resource identifier == req.user.id) OR possesses an administrative override role.
 * 
 * @param {string} paramKey The URL param name containing the target user ID (e.g. 'id' or 'userId')
 * @param {string[]} overrideRoles Roles permitted to bypass individual ownership check (default: ['ADMIN'])
 */
export const verifyUserOwnership = (paramKey = 'id', overrideRoles = ['ADMIN']) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const targetId = req.params[paramKey] || req.body[paramKey] || req.query[paramKey];
        if (!targetId) {
            return res.status(400).json({ success: false, error: `Missing required resource parameter: ${paramKey}` });
        }

        const isOwner = String(req.user.id) === String(targetId);
        const hasOverrideRole = overrideRoles.includes(req.user.role);

        if (isOwner || hasOverrideRole) {
            return next();
        }

        console.warn(`[Security Alert: IDOR Prevention] User ${req.user.username} (ID: ${req.user.id}, Role: ${req.user.role}) attempted unauthorized access to resource belonging to User ID ${targetId}`);
        return res.status(403).json({ 
            success: false, 
            error: 'IDOR Protection: Access Denied. You do not own this user resource.' 
        });
    };
};

// ---------------------------------------------------------
// AUTHENTICATION & USER MANAGEMENT ROUTES
// ---------------------------------------------------------

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
            { id: user.id || 1, username: user.username, role: user.role || 'ADMIN', mobile_number: user.mobile_number || '' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        await logDbActivity('LOGIN_SUCCESS', `User ${username} logged in`, { role: user.role || 'ADMIN' }, req);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                mobile_number: user.mobile_number || '',
                token
            }
        });

    } catch (e) {
        console.error("Login Error:", e);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Self Profile Lookup (Guaranteed IDOR-Safe by using req.user.id from verified JWT)
router.get('/auth/me', ensureDb, authenticateToken, async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            'SELECT id, username, role, mobile_number, created_at FROM app_users WHERE id = ?', 
            [req.user.id]
        );
        connection.release();

        if (rows.length === 0) {
            return res.json({
                success: true,
                user: {
                    id: req.user.id,
                    username: req.user.username,
                    role: req.user.role,
                    mobile_number: req.user.mobile_number || ''
                }
            });
        }

        res.json({ success: true, user: rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Self Profile Update (Guaranteed IDOR-Safe by using req.user.id from verified JWT)
router.put('/auth/me', ensureDb, authenticateToken, async (req, res) => {
    const { mobile_number, password } = req.body;

    try {
        const pool = getPool();
        const connection = await pool.getConnection();

        if (password && password.trim().length >= 4) {
            const hash = await bcrypt.hash(password, 10);
            await connection.query(
                "UPDATE app_users SET mobile_number = ?, password_hash = ? WHERE id = ?",
                [mobile_number || '', hash, req.user.id]
            );
        } else if (mobile_number !== undefined) {
            await connection.query(
                "UPDATE app_users SET mobile_number = ? WHERE id = ?",
                [mobile_number || '', req.user.id]
            );
        }

        connection.release();
        res.json({ success: true, message: 'Your profile has been updated.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Create User (Admin Only)
router.post('/auth/register', ensureDb, verifyAdmin, async (req, res) => {
    const { username, password, role, mobile_number } = req.body;

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

// Get all users (Admin Only)
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

// Get specific user by ID with strict IDOR verification
router.get('/auth/users/:id', ensureDb, authenticateToken, verifyUserOwnership('id', ['ADMIN']), async (req, res) => {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT id, username, role, mobile_number, created_at FROM app_users WHERE id = ?', [req.params.id]);
        connection.release();
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, user: rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Unified route to update staff member details with IDOR verification
// Non-admins can update their own mobile_number/password, but CANNOT escalate their role.
router.put('/auth/users/:id', ensureDb, authenticateToken, verifyUserOwnership('id', ['ADMIN']), async (req, res) => {
    const { role, mobile_number, password } = req.body;
    const isSelf = String(req.user.id) === String(req.params.id);
    const isAdmin = req.user.role === 'ADMIN';

    // Prevent privilege escalation by non-admins
    if (role && !isAdmin) {
        return res.status(403).json({ success: false, error: 'IDOR Protection: Only administrators can modify user roles.' });
    }
    
    if (role && !['ADMIN', 'MANAGER', 'SALES', 'KARIGAR'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid Role' });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        
        // Fetch current user details
        const [existingRows] = await connection.query('SELECT id, role FROM app_users WHERE id = ?', [req.params.id]);
        if (existingRows.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const effectiveRole = isAdmin && role ? role : existingRows[0].role;

        if (password && password.trim().length >= 4) {
            const hash = await bcrypt.hash(password, 10);
            await connection.query(
                "UPDATE app_users SET role = ?, mobile_number = ?, password_hash = ? WHERE id = ?",
                [effectiveRole, mobile_number || '', hash, req.params.id]
            );
        } else {
            await connection.query(
                "UPDATE app_users SET role = ?, mobile_number = ? WHERE id = ?",
                [effectiveRole, mobile_number || '', req.params.id]
            );
        }
        
        connection.release();
        res.json({ success: true, message: 'User updated successfully' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Update user role (Admin Only)
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

// Update user password with IDOR verification
router.put('/auth/users/:id/password', ensureDb, authenticateToken, verifyUserOwnership('id', ['ADMIN']), async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 4) {
        return res.status(400).json({ success: false, error: 'Password must be at least 4 characters long' });
    }

    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        const hash = await bcrypt.hash(password, 10);
        await connection.query("UPDATE app_users SET password_hash = ? WHERE id = ?", [hash, req.params.id]);
        connection.release();
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Delete user (Admin Only)
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
