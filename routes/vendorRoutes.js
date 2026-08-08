const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { authenticateJWT } = require('../middleware/authMiddleware');

router.use(authenticateJWT);

router.get('/', vendorController.getVendors);
router.get('/:id', vendorController.getVendorById);
router.post('/', vendorController.createVendor);
router.put('/:id', vendorController.updateVendor);
router.patch('/:id/status', vendorController.toggleVendorStatus);
router.delete('/:id', vendorController.deleteVendor);

module.exports = router;
