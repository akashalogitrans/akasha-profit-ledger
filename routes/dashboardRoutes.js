/* ==========================================================================
   AKASHA LOGITRANS LLP - DASHBOARD ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { getKPIs } = require('../controllers/dashboardController');

router.get('/kpis', getKPIs);

module.exports = router;
