/* ==========================================================================
   AKASHA LOGITRANS LLP - CLIENT MASTER ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { getClients, createClient, updateClient, deleteClient } = require('../controllers/clientController');

router.get('/', getClients);
router.post('/', createClient);
router.put('/:id', updateClient);
router.put('/*', updateClient);
router.delete('/:id', deleteClient);
router.delete('/*', deleteClient);

module.exports = router;
