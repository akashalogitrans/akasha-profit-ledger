/* ==========================================================================
   AKASHA LOGITRANS LLP - AUTHENTICATION CONTROLLER
   Enterprise Director Authentication, JWT Token Issuer, & Login Audit Logs
   ========================================================================== */

const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { recordFailedAttempt, resetFailedAttempts } = require('../middleware/rateLimiter');

// 1. DIRECTOR LOGIN (Strictly Requires BOTH Director Name AND PIN)
async function login(req, res) {
    const ip = req.clientIp || req.ip || '127.0.0.1';
    const browser = req.headers['user-agent'] || 'Unknown Browser';

    try {
        const { director_name, pin } = req.body;

        if (!director_name || !pin) {
            recordFailedAttempt(ip);
            await logLoginAttempt(director_name || 'UNKNOWN', ip, browser, 'FAILED_MISSING_CREDENTIALS');
            return res.status(400).json({
                success: false,
                message: 'Both Director Name AND Director Security PIN are required.'
            });
        }

        // Fetch Director Record from DB
        const [rows] = await pool.execute(
            `SELECT * FROM directors WHERE name = ? AND status = 'Active'`,
            [director_name.trim()]
        );

        if (!rows || rows.length === 0) {
            recordFailedAttempt(ip);
            await logLoginAttempt(director_name, ip, browser, 'FAILED_INVALID_DIRECTOR');
            return res.status(401).json({
                success: false,
                message: 'Invalid Director Name or Security PIN.'
            });
        }

        const director = rows[0];

        // Verify PIN against stored bcrypt hash or legacy fallback
        let isMatch = await bcrypt.compare(String(pin).trim(), director.pin_hash);
        
        // Fallback check for initial unhashed PINs
        if (!isMatch && (
            (director_name.includes('Dhruv') && String(pin).trim() === '7717') ||
            (director_name.includes('Khushal') && String(pin).trim() === '7776') ||
            (director_name.includes('Yagnik') && String(pin).trim() === '8866')
        )) {
            isMatch = true;
            // Upgrade hash in background
            const newHash = await bcrypt.hash(String(pin).trim(), 10);
            await pool.execute(`UPDATE directors SET pin_hash = ? WHERE id = ?`, [newHash, director.id]);
        }

        if (!isMatch) {
            recordFailedAttempt(ip);
            await logLoginAttempt(director_name, ip, browser, 'FAILED_INVALID_PIN');
            return res.status(401).json({
                success: false,
                message: 'Invalid Director Security PIN.'
            });
        }

        // Login Successful - Reset Failed Attempts
        resetFailedAttempts(ip);
        await logLoginAttempt(director_name, ip, browser, 'SUCCESS');

        // Generate Signed JWT Token (Valid 12 Hours)
        const tokenPayload = {
            id: director.id,
            name: director.name,
            email: director.email,
            role: director.role,
            avatar: director.avatar
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '12h' });

        return res.json({
            success: true,
            message: `Welcome back, ${director.name}! Session authenticated successfully.`,
            token,
            user: tokenPayload
        });

    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({ success: false, message: 'Internal Authentication Error: ' + err.message });
    }
}

// 2. VERIFY JWT TOKEN SESSION
async function verifySession(req, res) {
    try {
        return res.json({
            success: true,
            user: req.user
        });
    } catch (e) {
        return res.status(401).json({ success: false, message: 'Session invalid' });
    }
}

// 3. GET LIST OF ACTIVE DIRECTORS (For Login Dropdown)
async function getDirectors(req, res) {
    try {
        const [rows] = await pool.execute(`SELECT id, name, role, avatar FROM directors WHERE status = 'Active' ORDER BY name ASC`);
        return res.json(rows || []);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// Helper: Audit Log Entry
async function logLoginAttempt(userName, ip, browser, status) {
    try {
        await pool.execute(
            `INSERT INTO login_logs (user_name, ip, browser, status) VALUES (?, ?, ?, ?)`,
            [userName, ip, browser, status]
        );
    } catch (e) {
        console.error('Login log error:', e.message);
    }
}

module.exports = {
    login,
    verifySession,
    getDirectors
};
