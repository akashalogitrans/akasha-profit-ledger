/* ==========================================================================
   AKASHA LOGITRANS LLP - DASHBOARD ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { getKPIs } = require('../controllers/dashboardController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// Protected Dashboard endpoints
router.use(authenticateJWT);

router.get('/kpis', getKPIs);

module.exports = router;
