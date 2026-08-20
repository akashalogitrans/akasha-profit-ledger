/* ==========================================================================
   AKASHA LOGITRANS LLP - AUTHENTICATION ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { login, forgotMpin, setMpin, verifySession, getDirectors } = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { loginRateLimiter } = require('../middleware/rateLimiter');

// Public Login Endpoint (Rate Limited)
router.post('/login', loginRateLimiter, login);

// Forgot / Reset MPIN (Requires Last MPIN)
router.post('/forgot-mpin', forgotMpin);
router.post('/set-mpin', setMpin);

// Public List of Directors Endpoint (For Login Dropdown)
router.get('/directors', getDirectors);

// Protected Verify Session Endpoint
router.get('/me', authenticateJWT, verifySession);

module.exports = router;
