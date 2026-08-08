const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateJWT } = require('../middleware/authMiddleware');

router.use(authenticateJWT);

router.get('/receivable', reportController.getReceivableReport);
router.get('/payable', reportController.getPayableReport);
router.get('/profit', reportController.getProfitReport);
router.get('/gst', reportController.getGstReport);
router.get('/monthly-ledger', reportController.getMonthlyLedger);

module.exports = router;
