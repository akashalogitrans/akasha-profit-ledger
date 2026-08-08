/* ==========================================================================
   AKASHA LOGITRANS LLP - LEDGER & MULTI-INSTALLMENT PAYMENTS ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { 
    getPaymentsReceived, 
    getPaymentTransactions,
    recordPayment,
    deletePaymentTransaction
} = require('../controllers/ledgerController');
const { authenticateJWT } = require('../middleware/authMiddleware');

router.use(authenticateJWT);

router.get('/payments-received', getPaymentsReceived);
router.get('/payments', getPaymentsReceived);
router.post('/payments', recordPayment);
router.get('/payment-transactions/:id', getPaymentTransactions);
router.delete('/payment-transactions/:id', deletePaymentTransaction);

module.exports = router;
