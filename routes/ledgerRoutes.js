/* ==========================================================================
   AKASHA LOGITRANS LLP - LEDGER & MULTI-INSTALLMENT PAYMENTS ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { 
    getPaymentsReceived, 
    getPaymentTransactions,
    addPaymentTransaction,
    updatePaymentReceived, 
    deletePaymentTransaction,
    getPurchases, 
    getProfitLedger 
} = require('../controllers/ledgerController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// All Ledger & Payment endpoints are protected by JWT Auth Middleware
router.use(authenticateJWT);

router.get('/payments-received', getPaymentsReceived);
router.put('/payments-received/:id', updatePaymentReceived);

// Payment Transactions History Timeline APIs
router.get('/payment-transactions/:id', getPaymentTransactions);
router.post('/payment-transactions', addPaymentTransaction);
router.delete('/payment-transactions/:txId', deletePaymentTransaction);

router.get('/purchases', getPurchases);
router.get('/profit-ledger', getProfitLedger);

module.exports = router;
