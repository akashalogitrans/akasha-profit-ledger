/* ==========================================================================
   AKASHA LOGITRANS LLP - AUTHENTICATION CONTROLLER
   Enterprise Director Authentication, JWT Token Issuer, & Login Audit Logs
   ========================================================================== */

const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { recordFailedAttempt, resetFailedAttempts } = require('../middleware/rateLimiter');

// 1. DIRECTOR LOGIN (Strict Phone Number or Full Name Username + 4-Digit MPIN)
async function login(req, res) {
    const ip = req.clientIp || req.ip || '127.0.0.1';
    const browser = req.headers['user-agent'] || 'Unknown Browser';

    try {
        let { username, phone, identifier, pin, mpin } = req.body;

        const inputPin = String(mpin || pin || '').trim();
        const inputId = String(identifier || phone || username || '').trim();

        if (!inputId) {
            return res.status(400).json({
                success: false,
                message: 'Full Username (e.g. YAGNIKSORATHIYA) or Phone Number is required.'
            });
        }

        if (!inputPin) {
            return res.status(400).json({
                success: false,
                message: '4-Digit Security MPIN is required.'
            });
        }

        const normalizedInput = inputId.toLowerCase().replace(/[^a-z0-9]/g, '');
        const phoneInput = inputId.replace(/[^0-9]/g, '');

        // Fetch Directors from database
        let [rows] = await pool.execute(`SELECT * FROM directors WHERE status = 'Active'`);
        if (!rows || rows.length === 0) {
            rows = [
                { id: 'dir_1', name: 'KHUSHAL VASOYA', phone: '9328227962', email: 'khushal@akashalogitrans.com', role: 'CEO & Founder', avatar: 'https://akashalogitrans.com/khushal.png' },
                { id: 'dir_2', name: 'DHRUV THESHIYA', phone: '8155068853', email: 'dhruv@akashalogitrans.com', role: 'Director - Rates & Procurement', avatar: 'https://akashalogitrans.com/dhruv_patel.png' },
                { id: 'dir_3', name: 'YAGNIK SORATHIYA', phone: '9924929129', email: 'info@akashalogitrans.com', role: 'Director - Finance & Audit', avatar: 'https://akashalogitrans.com/yagnik.jpeg' }
            ];
        }

        // Strict Full-Name / 10-Digit Phone Match ONLY
        let matchedDir = rows.find(d => {
            const dNorm = (d.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const dPhone = (d.phone || '').replace(/[^0-9]/g, '');

            if (phoneInput && phoneInput.length === 10 && dPhone === phoneInput) {
                return true;
            }
            if (normalizedInput && normalizedInput === dNorm) {
                return true;
            }
            return false;
        });

        if (!matchedDir) {
            recordFailedAttempt(ip);
            await logLoginAttempt(inputId, ip, browser, 'FAILED_INVALID_DIRECTOR');
            return res.status(401).json({
                success: false,
                message: 'Unauthorized Account! Enter full registered name (e.g. YAGNIKSORATHIYA) or 10-digit Phone No.'
            });
        }

        const director = matchedDir;
        const dPhone = (director.phone || '').replace(/[^0-9]/g, '');

        // Verify 4-Digit MPIN
        let isMatch = false;
        if (director.pin_hash) {
            try {
                isMatch = await bcrypt.compare(inputPin, director.pin_hash);
            } catch (e) {}
        }

        // Exact MPIN fallbacks for the 3 verified accounts
        if (!isMatch) {
            if (dPhone.includes('9924929129') && inputPin === '8866') isMatch = true;
            else if (dPhone.includes('9328227962') && inputPin === '7776') isMatch = true;
            else if (dPhone.includes('8155068853') && inputPin === '7717') isMatch = true;
        }

        if (!isMatch) {
            recordFailedAttempt(ip);
            await logLoginAttempt(director.name, ip, browser, 'FAILED_INVALID_MPIN');
            return res.status(401).json({
                success: false,
                message: 'Incorrect 4-Digit MPIN. Please try again.'
            });
        }

        // Login Successful
        resetFailedAttempts(ip);
        await logLoginAttempt(director.name, ip, browser, 'SUCCESS');

        const tokenPayload = {
            id: director.id,
            name: director.name,
            email: director.email,
            phone: director.phone,
            role: director.role,
            avatar: director.avatar
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '12h' });

        return res.json({
            success: true,
            message: `Welcome back, ${director.name}! Authenticated successfully.`,
            token,
            user: tokenPayload
        });

    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({ success: false, message: 'Internal Authentication Error: ' + err.message });
    }
}

// 2. FORGOT / CHANGE 4-DIGIT MPIN (Requires Last Valid MPIN)
async function forgotMpin(req, res) {
    try {
        const { identifier, username_or_phone, old_mpin, last_mpin, new_mpin } = req.body;
        const inputId = String(identifier || username_or_phone || '').trim();
        const oldPin = String(old_mpin || last_mpin || '').trim();
        const newPin = String(new_mpin || '').trim();

        if (!inputId) {
            return res.status(400).json({ success: false, message: 'Please enter Full Username or Phone Number.' });
        }
        if (!oldPin) {
            return res.status(400).json({ success: false, message: 'Please enter your Last / Current 4-Digit MPIN.' });
        }
        if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
            return res.status(400).json({ success: false, message: 'New MPIN must be exactly 4 numeric digits.' });
        }

        const normalizedInput = inputId.toLowerCase().replace(/[^a-z0-9]/g, '');
        const phoneInput = inputId.replace(/[^0-9]/g, '');

        let [rows] = await pool.execute(`SELECT * FROM directors WHERE status = 'Active'`);
        let director = (rows || []).find(d => {
            const dNorm = (d.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const dPhone = (d.phone || '').replace(/[^0-9]/g, '');
            if (phoneInput && phoneInput.length === 10 && dPhone === phoneInput) return true;
            if (normalizedInput && normalizedInput === dNorm) return true;
            return false;
        });

        if (!director) {
            return res.status(404).json({ success: false, message: 'Director account not found. Enter full registered name.' });
        }

        // Validate Last MPIN
        let isOldValid = false;
        if (director.pin_hash) {
            try {
                isOldValid = await bcrypt.compare(oldPin, director.pin_hash);
            } catch (e) {}
        }

        const dPhone = (director.phone || '').replace(/[^0-9]/g, '');
        if (!isOldValid) {
            if (dPhone.includes('9924929129') && oldPin === '8866') isOldValid = true;
            else if (dPhone.includes('9328227962') && oldPin === '7776') isOldValid = true;
            else if (dPhone.includes('8155068853') && oldPin === '7717') isOldValid = true;
        }

        if (!isOldValid) {
            return res.status(400).json({
                success: false,
                message: 'Incorrect Last / Current MPIN! Please enter your correct previous MPIN to reset.'
            });
        }

        // Hash and Update to New 4-Digit MPIN
        const newHash = await bcrypt.hash(newPin, 10);
        await pool.execute(`UPDATE directors SET pin_hash = ? WHERE id = ?`, [newHash, director.id]);

        return res.json({
            success: true,
            message: `4-Digit MPIN for ${director.name} updated successfully! You can now log in with your new MPIN.`
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. VERIFY JWT TOKEN SESSION
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

// 4. GET LIST OF ACTIVE DIRECTORS
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
    forgotMpin,
    setMpin: forgotMpin,
    verifySession,
    getDirectors
};
