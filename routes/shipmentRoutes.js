const express = require('express');
const router = express.Router();
const { getShipments, getShipmentById, getNextShipmentId, createShipment, updateShipment, deleteShipment } = require('../controllers/shipmentController');
const { authenticateJWT } = require('../middleware/authMiddleware');

router.use(authenticateJWT);

router.get('/next-id', getNextShipmentId);
router.get('/', getShipments);
router.post('/', createShipment);

// Use wildcard routes for IDs containing slashes (e.g. AKASHA/CLI-101/001)
router.get('/*', getShipmentById);
router.put('/*', updateShipment);
router.delete('/*', deleteShipment);

module.exports = router;
