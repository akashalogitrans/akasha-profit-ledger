/* ==========================================================================
   AKASHA LOGITRANS LLP - SHIPMENT MASTER ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { getShipments, createShipment, updateShipment, deleteShipment } = require('../controllers/shipmentController');

router.get('/', getShipments);
router.post('/', createShipment);
router.put('/:id', updateShipment);
router.put('/*', updateShipment);
router.delete('/:id', deleteShipment);
router.delete('/*', deleteShipment);

module.exports = router;
