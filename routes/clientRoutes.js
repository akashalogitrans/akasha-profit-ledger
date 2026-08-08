const express = require('express');
const router = express.Router();
const { getClients, getClientById, createClient, updateClient, toggleClientStatus, deleteClient } = require('../controllers/clientController');
const { authenticateJWT } = require('../middleware/authMiddleware');

router.use(authenticateJWT);

router.get('/', getClients);
router.get('/:id', getClientById);
router.post('/', createClient);
router.put('/:id', updateClient);
router.patch('/:id/status', toggleClientStatus);
router.delete('/:id', deleteClient);

module.exports = router;
