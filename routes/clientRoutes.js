/* ==========================================================================
   AKASHA LOGITRANS LLP - CLIENT MASTER ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();
const { getClients, getClientById, createClient, updateClient, deleteClient } = require('../controllers/clientController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// All Client Master endpoints are protected by JWT Auth Middleware
router.use(authenticateJWT);

router.get('/', getClients);
router.get('/:id', getClientById);
router.post('/', createClient);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);

module.exports = router;
