/* ==========================================================================
   AKASHA LOGITRANS LLP - EXPENSE CONTROLLER
   Office & Direct Expenses Management with Month-wise Grouping & FY Summary
   ========================================================================== */

const pool = require('../config/db');

// Helper: Generate next Expense ID (e.g. EXP-001)
async function generateExpenseId() {
    const [rows] = await pool.execute('SELECT id FROM expenses ORDER BY created_at DESC, id DESC LIMIT 100');
    let maxNum = 0;
    (rows || []).forEach(r => {
        const match = r.id.match(/EXP-(\d+)/i);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
        }
    });
    return 'EXP-' + String(maxNum + 1).padStart(3, '0');
}

// 1. GET ALL EXPENSES (with month filtering & search)
async function getExpenses(req, res) {
    try {
        const { month, year, search, category } = req.query;
        let sql = 'SELECT * FROM expenses WHERE 1=1';
        const params = [];

        if (month) {
            sql += " AND DATE_FORMAT(expense_date, '%Y-%m') = ?";
            params.push(month);
        }
        if (year) {
            sql += " AND DATE_FORMAT(expense_date, '%Y') = ?";
            params.push(year);
        }
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }
        if (search) {
            sql += ' AND (id LIKE ? OR category LIKE ? OR paid_to LIKE ? OR purpose LIKE ?)';
            const q = `%${search.trim()}%`;
            params.push(q, q, q, q);
        }

        sql += ' ORDER BY expense_date DESC, id DESC';
        const [rows] = await pool.execute(sql, params);
        return res.json(rows || []);
    } catch (err) {
        console.error('Get Expenses Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 2. GET EXPENSE SUMMARY (Financial Year & Month-Wise)
async function getExpenseSummary(req, res) {
    try {
        const [allRows] = await pool.execute('SELECT * FROM expenses ORDER BY expense_date DESC');
        
        let totalExpenseAll = 0;
        let totalExpenseFY = 0;
        const now = new Date();
        const curYear = now.getFullYear();
        // Indian Financial Year: April 1 to March 31
        const curMonth = now.getMonth() + 1; // 1-12
        const fyStartYear = curMonth >= 4 ? curYear : curYear - 1;
        const fyStartDate = `${fyStartYear}-04-01`;
        const fyEndDate = `${fyStartYear + 1}-03-31`;

        const monthGroups = {};

        (allRows || []).forEach(e => {
            const amt = parseFloat(e.amount) || 0;
            totalExpenseAll += amt;

            if (e.expense_date >= fyStartDate && e.expense_date <= fyEndDate) {
                totalExpenseFY += amt;
            }

            const mKey = (e.expense_date || '').substring(0, 7); // 'YYYY-MM'
            if (mKey) {
                if (!monthGroups[mKey]) {
                    monthGroups[mKey] = {
                        month_key: mKey,
                        month_label: new Date(mKey + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
                        total_amount: 0,
                        count: 0,
                        expenses: []
                    };
                }
                monthGroups[mKey].total_amount += amt;
                monthGroups[mKey].count += 1;
                monthGroups[mKey].expenses.push(e);
            }
        });

        return res.json({
            success: true,
            total_expense_all: totalExpenseAll,
            total_expense_fy: totalExpenseFY,
            fy_label: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
            months: Object.values(monthGroups)
        });
    } catch (err) {
        console.error('Get Expense Summary Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. CREATE NEW EXPENSE
async function createExpense(req, res) {
    try {
        const { expense_date, category, paid_to, amount, payment_mode, reference_no, purpose } = req.body;
        if (!expense_date || !category || !paid_to || !amount) {
            return res.status(400).json({ success: false, message: 'Expense Date, Category, Paid To, and Amount are required.' });
        }

        const id = await generateExpenseId();
        const recorded_by = req.user?.name || req.body.recorded_by || 'Director';

        await pool.execute(
            `INSERT INTO expenses (id, expense_date, category, paid_to, amount, payment_mode, reference_no, purpose, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, expense_date, category, paid_to, parseFloat(amount) || 0, payment_mode || 'Bank Transfer', reference_no || '', purpose || '', recorded_by]
        );

        return res.status(201).json({ success: true, message: 'Expense recorded successfully.', id });
    } catch (err) {
        console.error('Create Expense Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. UPDATE EXPENSE
async function updateExpense(req, res) {
    try {
        const { id } = req.params;
        const { expense_date, category, paid_to, amount, payment_mode, reference_no, purpose } = req.body;

        const [existing] = await pool.execute('SELECT * FROM expenses WHERE id = ?', [id]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Expense record not found.' });
        }

        await pool.execute(
            `UPDATE expenses 
             SET expense_date = ?, category = ?, paid_to = ?, amount = ?, payment_mode = ?, reference_no = ?, purpose = ?
             WHERE id = ?`,
            [
                expense_date || existing[0].expense_date,
                category || existing[0].category,
                paid_to || existing[0].paid_to,
                amount !== undefined ? parseFloat(amount) : existing[0].amount,
                payment_mode || existing[0].payment_mode,
                reference_no !== undefined ? reference_no : existing[0].reference_no,
                purpose !== undefined ? purpose : existing[0].purpose,
                id
            ]
        );

        return res.json({ success: true, message: 'Expense updated successfully.' });
    } catch (err) {
        console.error('Update Expense Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 5. DELETE EXPENSE
async function deleteExpense(req, res) {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM expenses WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Expense record deleted.' });
    } catch (err) {
        console.error('Delete Expense Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getExpenses,
    getExpenseSummary,
    createExpense,
    updateExpense,
    deleteExpense
};
