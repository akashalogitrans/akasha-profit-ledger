const express = require('express');
const router = express.Router();
const vendorPaymentController = require('../controllers/vendorPaymentController');
const { authenticateJWT } = require('../middleware/authMiddleware');

router.use(authenticateJWT);

router.get('/', vendorPaymentController.getVendorPayments);
router.post('/', vendorPaymentController.recordVendorPayment);
router.delete('/:id', vendorPaymentController.deleteVendorPayment);

module.exports = router;
