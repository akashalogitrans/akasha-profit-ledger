/* ==========================================================================
   AKASHA LOGITRANS LLP - EXPENSE ROUTES
   ========================================================================== */

const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { authenticateJWT } = require('../middleware/authMiddleware');

router.use(authenticateJWT);

router.get('/', expenseController.getExpenses);
router.get('/summary', expenseController.getExpenseSummary);
router.post('/', expenseController.createExpense);
router.put('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
