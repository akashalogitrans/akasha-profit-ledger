/* ==========================================================================
   AKASHA LOGITRANS LLP - EXPENSE CONTROLLER
   Office & Direct Expenses Management with Month-wise Grouping & Indian FY Summary
   ========================================================================== */

const pool = require('../config/db');
const { safeNumber } = require('../utils/financialUtils');
const { normalizeDateOnly, calculateFinancialYear, getFinancialYearDates, getMonthKeyAndLabel } = require('../utils/dateUtils');

// Helper: Generate next Expense ID (e.g. EXP-001)
async function generateExpenseId() {
    const [rows] = await pool.execute('SELECT id FROM expenses ORDER BY created_at DESC, id DESC LIMIT 100');
    let maxNum = 0;
    (rows || []).forEach(r => {
        const match = (r.id || '').match(/EXP-(\d+)/i);
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
        const { month, year, search, category, shipment_id } = req.query;
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
        if (shipment_id) {
            sql += ' AND shipment_id = ?';
            params.push(shipment_id.trim());
        }
        if (search) {
            sql += ' AND (id LIKE ? OR category LIKE ? OR paid_to LIKE ? OR purpose LIKE ? OR shipment_id LIKE ?)';
            const q = `%${search.trim()}%`;
            params.push(q, q, q, q, q);
        }

        sql += ' ORDER BY expense_date DESC, id DESC';
        const [rows] = await pool.execute(sql, params);

        const sanitized = (rows || []).map(r => ({
            ...r,
            expense_date: normalizeDateOnly(r.expense_date),
            amount: safeNumber(r.amount, 0),
            shipment_id: r.shipment_id || null,
            is_direct_expense: !!(r.shipment_id && r.shipment_id.trim())
        }));

        return res.json(sanitized);
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
        let totalDirectExpense = 0;
        let totalOperatingExpense = 0;

        const now = new Date();
        const curFYLabel = calculateFinancialYear(now);
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;
        const fyStartYear = curMonth >= 4 ? curYear : curYear - 1;
        const fyDates = getFinancialYearDates(fyStartYear);

        const monthGroups = {};

        (allRows || []).forEach(e => {
            const amt = safeNumber(e.amount, 0);
            const dateStr = normalizeDateOnly(e.expense_date);
            totalExpenseAll += amt;

            if (e.shipment_id && String(e.shipment_id).trim()) {
                totalDirectExpense += amt;
            } else {
                totalOperatingExpense += amt;
            }

            if (dateStr >= fyDates.startDate && dateStr <= fyDates.endDate) {
                totalExpenseFY += amt;
            }

            const monthInfo = getMonthKeyAndLabel(dateStr);
            const mKey = monthInfo.monthKey;
            if (mKey) {
                if (!monthGroups[mKey]) {
                    monthGroups[mKey] = {
                        month_key: mKey,
                        month_label: monthInfo.monthLabel,
                        total_amount: 0,
                        direct_amount: 0,
                        operating_amount: 0,
                        count: 0,
                        expenses: []
                    };
                }
                monthGroups[mKey].total_amount += amt;
                if (e.shipment_id && String(e.shipment_id).trim()) {
                    monthGroups[mKey].direct_amount += amt;
                } else {
                    monthGroups[mKey].operating_amount += amt;
                }
                monthGroups[mKey].count += 1;
                monthGroups[mKey].expenses.push({
                    ...e,
                    expense_date: dateStr,
                    amount: amt
                });
            }
        });

        return res.json({
            success: true,
            total_expense_all: Math.round(totalExpenseAll * 100) / 100,
            total_expense_fy: Math.round(totalExpenseFY * 100) / 100,
            total_direct_expenses: Math.round(totalDirectExpense * 100) / 100,
            total_operating_expenses: Math.round(totalOperatingExpense * 100) / 100,
            fy_label: curFYLabel,
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
        const { expense_date, category, paid_to, amount, payment_mode, reference_no, purpose, shipment_id } = req.body;
        if (!expense_date || !category || !paid_to || amount === undefined) {
            return res.status(400).json({ success: false, message: 'Expense Date, Category, Paid To, and Amount are required.' });
        }

        const amt = safeNumber(amount, -1);
        if (amt < 0) {
            return res.status(400).json({ success: false, message: 'Expense Amount must be a valid number (>= 0).' });
        }

        const id = await generateExpenseId();
        const recorded_by = req.user?.name || req.body.recorded_by || 'Director';
        const dateStr = normalizeDateOnly(expense_date);
        const shpId = shipment_id ? String(shipment_id).trim() : null;

        await pool.execute(
            `INSERT INTO expenses (id, shipment_id, expense_date, category, paid_to, amount, payment_mode, reference_no, purpose, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, shpId, dateStr, category, paid_to, amt, payment_mode || 'Bank Transfer', reference_no || '', purpose || '', recorded_by]
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
        const { expense_date, category, paid_to, amount, payment_mode, reference_no, purpose, shipment_id } = req.body;

        const [existing] = await pool.execute('SELECT * FROM expenses WHERE id = ?', [id]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Expense record not found.' });
        }

        const amt = amount !== undefined ? safeNumber(amount, safeNumber(existing[0].amount, 0)) : safeNumber(existing[0].amount, 0);
        const dateStr = expense_date ? normalizeDateOnly(expense_date) : normalizeDateOnly(existing[0].expense_date);
        const shpId = shipment_id !== undefined ? (shipment_id ? String(shipment_id).trim() : null) : existing[0].shipment_id;

        await pool.execute(
            `UPDATE expenses 
             SET shipment_id = ?, expense_date = ?, category = ?, paid_to = ?, amount = ?, payment_mode = ?, reference_no = ?, purpose = ?
             WHERE id = ?`,
            [
                shpId,
                dateStr,
                category || existing[0].category,
                paid_to || existing[0].paid_to,
                amt,
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
