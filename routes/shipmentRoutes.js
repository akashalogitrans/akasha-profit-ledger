/* ==========================================================================
   AKASHA LOGITRANS LLP - SHIPMENT MASTER ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { getShipments, getShipmentById, createShipment, updateShipment, deleteShipment } = require('../controllers/shipmentController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// All Shipment endpoints are protected by JWT Auth Middleware
router.use(authenticateJWT);

router.get('/', getShipments);
router.get('/:id', getShipmentById);
router.post('/', createShipment);
router.put('/:id', updateShipment);
router.delete('/:id', deleteShipment);

module.exports = router;
