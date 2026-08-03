/* ==========================================================================
   AKASHA LOGITRANS LLP - AUTHENTICATION MIDDLEWARE (JWT)
   ========================================================================== */

const jwt = require('jsonwebtoken');
try { require('dotenv').config(); } catch (e) {}

const JWT_SECRET = process.env.JWT_SECRET || 'akasha_erp_super_secret_jwt_key_2026';

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // Fallback for public API endpoints or session-based admin access
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired access token' });
        }
        req.user = user;
        next();
    });
}

module.exports = { verifyToken, JWT_SECRET };
