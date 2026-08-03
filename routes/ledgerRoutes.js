/* ==========================================================================
   AKASHA LOGITRANS LLP - LEDGER & PAYMENTS ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { getPaymentsReceived, updatePaymentReceived, getPurchases, getProfitLedger } = require('../controllers/ledgerController');

router.get('/payments-received', getPaymentsReceived);
router.put('/payments-received/:id', updatePaymentReceived);
router.put('/payments-received/*', updatePaymentReceived);

router.get('/purchases', getPurchases);
router.get('/profit-ledger', getProfitLedger);

module.exports = router;
