/* ==========================================================================
   AKASHA LOGITRANS LLP - AUTHENTICATION CONTROLLER
   ========================================================================== */

const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const ADMIN_DIRECTORS = [
    { id: "usr_1", name: "Khushal Patel", role: "CEO & Founder", email: "khushal@akashalogitrans.com", pin: "7776", keyName: "KHUSHAL", avatar: "https://akashalogitrans.com/khushal.png" },
    { id: "usr_2", name: "Dhruv Patel", role: "Director - Rates & Procurement", email: "dhruv@akashalogitrans.com", pin: "7717", keyName: "DHRUV", avatar: "https://akashalogitrans.com/dhruv_patel.png" },
    { id: "usr_3", name: "Yagnik Patel", role: "Director - Finance & Audit", email: "info@akashalogitrans.com", pin: "8866", keyName: "YAGNIK", avatar: "https://akashalogitrans.com/yagnik.jpeg" }
];

async function login(req, res) {
    try {
        const { pin, keyName, email, password } = req.body;

        if (pin || keyName) {
            const matched = ADMIN_DIRECTORS.find(u => 
                u.pin === String(pin).trim() && 
                (u.keyName === String(keyName).trim().toUpperCase() || u.name.toUpperCase().includes(String(keyName).trim().toUpperCase()))
            );

            if (!matched) {
                return res.status(401).json({ success: false, message: 'Invalid Director PIN or Name! Access restricted to authorized directors.' });
            }

            const token = jwt.sign(
                { id: matched.id, name: matched.name, email: matched.email, role: matched.role },
                JWT_SECRET,
                { expiresIn: '30d' }
            );

            return res.json({
                success: true,
                message: `Authentication Successful for ${matched.name}`,
                token,
                user: matched
            });
        }

        if (email) {
            const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
            const user = rows[0];

            if (!user) {
                return res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
            }

            if (password && user.password_hash && user.password_hash !== 'hash') {
                const isValid = await bcrypt.compare(password, user.password_hash);
                if (!isValid) {
                    return res.status(401).json({ success: false, message: 'Invalid Password' });
                }
            }

            const token = jwt.sign(
                { id: user.id, name: user.name, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: '30d' }
            );

            return res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    avatar: user.avatar
                }
            });
        }

        return res.status(400).json({ success: false, message: 'PIN & Director Name or Email is required' });
    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function getMe(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        return res.json({ success: true, user: req.user });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { login, getMe };
