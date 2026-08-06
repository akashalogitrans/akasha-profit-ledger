/* ==========================================================================
   AKASHA LOGITRANS LLP - JWT AUTHENTICATION MIDDLEWARE
   Strict Protection Guard for all Protected API Routes
   ========================================================================== */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'AKASHA_LOGITRANS_ERP_JWT_SECRET_7776';

function authenticateJWT(req, res, next) {
    // Allow public routes
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized Access. Valid JWT Token Required.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Session Expired or Invalid Token. Please Login Again.',
            expired: true
        });
    }
}

module.exports = { authenticateJWT, JWT_SECRET };
