/* ==========================================================================
   AKASHA LOGITRANS LLP - DASHBOARD CONTROLLER
   Actual Received Revenue, Pending Receivables, & Executive KPI Widgets
   Hardened with Central Financial Engine & Indian FY Consistency
   ========================================================================== */

const pool = require('../config/db');
const { safeNumber, calculateMarginPercentage } = require('../utils/financialUtils');
const { normalizeDateOnly, calculateFinancialYear, getFinancialYearDates } = require('../utils/dateUtils');

async function getKPIs(req, res) {
    try {
        const todayStr = normalizeDateOnly(new Date());
        const monthStr = todayStr.substring(0, 7);

        // 1. Overall Financial & Shipment Metrics
        const kpiSql = `
            SELECT 
                COALESCE(SUM(LEAST(s.sale_amount, COALESCE(s.received_amount, 0))), 0) AS total_revenue,
                COALESCE(SUM(s.sale_amount), 0) AS total_sale_billed,
                COALESCE(SUM(s.purchase_amount), 0) AS total_purchase,
                COALESCE(SUM(s.net_profit), 0) AS net_profit,
                COALESCE(SUM(
                    GREATEST(0, s.sale_amount - LEAST(s.sale_amount, COALESCE(s.received_amount, 0)))
                ), 0) AS pending_payment,
                COALESCE(SUM(
                    GREATEST(0, s.purchase_amount - COALESCE(vp.paid, 0))
                ), 0) AS vendor_payable,
                COUNT(s.id) AS total_shipments,
                SUM(CASE WHEN s.sale_status = 'PAID' OR (s.received_amount >= s.sale_amount AND s.sale_amount > 0) THEN 1 ELSE 0 END) AS completed_shipments,
                SUM(CASE WHEN s.sale_status != 'PAID' AND (s.received_amount < s.sale_amount OR s.sale_amount = 0) THEN 1 ELSE 0 END) AS pending_shipments
            FROM shipments s
            LEFT JOIN (
                SELECT shipment_id, SUM(amount) AS paid 
                FROM vendor_payments 
                GROUP BY shipment_id
            ) vp ON (s.id COLLATE utf8mb4_general_ci) = (vp.shipment_id COLLATE utf8mb4_general_ci)
        `;
        const [kpiRows] = await pool.execute(kpiSql);
        const kpi = kpiRows[0] || {};

        // 2. Collection Metrics (Today & This Month)
        const collectionSql = `
            SELECT 
                COALESCE(SUM(CASE WHEN CAST(payment_date AS CHAR) = CAST(? AS CHAR) THEN amount ELSE 0 END), 0) AS todays_collection,
                COALESCE(SUM(CASE WHEN DATE_FORMAT(payment_date, '%Y-%m') = CAST(? AS CHAR) THEN amount ELSE 0 END), 0) AS monthly_collection
            FROM payment_transactions
        `;
        const [collRows] = await pool.execute(collectionSql, [todayStr, monthStr]);
        const coll = collRows[0] || {};

        // 3. Top Clients by Revenue
        const topClientsSql = `
            SELECT 
                company_name, 
                COUNT(id) as shipments, 
                SUM(sale_amount) as billed, 
                SUM(LEAST(sale_amount, COALESCE(received_amount, 0))) as received
            FROM shipments 
            GROUP BY company_name 
            ORDER BY billed DESC 
            LIMIT 5
        `;
        const [topClients] = await pool.execute(topClientsSql);

        // 4. Latest Payment Transactions
        const recentPaymentsSql = `
            SELECT pt.*, s.company_name 
            FROM payment_transactions pt
            JOIN shipments s ON (pt.shipment_id COLLATE utf8mb4_general_ci) = (s.id COLLATE utf8mb4_general_ci)
            ORDER BY pt.created_at DESC 
            LIMIT 6
        `;
        const [recentPayments] = await pool.execute(recentPaymentsSql);

        // 5. Total Expenses for Current Financial Year
        const now = new Date();
        const curFYLabel = calculateFinancialYear(now);
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;
        const fyStartYear = curMonth >= 4 ? curYear : curYear - 1;
        const fyDates = getFinancialYearDates(fyStartYear);

        let fyExpense = 0;
        let fyExpenseCount = 0;
        try {
            const [expRows] = await pool.execute(
                `SELECT COALESCE(SUM(amount), 0) AS fy_expense, COUNT(id) AS fy_expense_count FROM expenses WHERE expense_date >= ? AND expense_date <= ?`,
                [fyDates.startDate, fyDates.endDate]
            );
            fyExpense = expRows ? safeNumber(expRows[0].fy_expense, 0) : 0;
            fyExpenseCount = expRows ? parseInt(expRows[0].fy_expense_count, 10) || 0 : 0;
        } catch (e) {}

        // 6. Client Opening Balances Total
        let clientOpeningBalTotal = 0;
        try {
            const [clRows] = await pool.execute(`SELECT COALESCE(SUM(opening_balance), 0) AS total_opening_bal FROM clients WHERE status = 'ACTIVE'`);
            clientOpeningBalTotal = clRows ? safeNumber(clRows[0].total_opening_bal, 0) : 0;
        } catch (e) {}

        const totalBilled = safeNumber(kpi.total_sale_billed, 0);
        const netProfit = safeNumber(kpi.net_profit, 0);
        const marginPct = calculateMarginPercentage(totalBilled, netProfit);
        const pendingReceivables = safeNumber(kpi.pending_payment, 0) + clientOpeningBalTotal;

        return res.json({
            success: true,
            monthly_revenue: safeNumber(kpi.total_revenue, 0),
            total_sale_billed: totalBilled,
            total_purchase: safeNumber(kpi.total_purchase, 0),
            net_profit: netProfit,
            margin_pct: marginPct,
            pending_payment: pendingReceivables,
            shipment_receivable: safeNumber(kpi.pending_payment, 0),
            client_opening_balance: clientOpeningBalTotal,
            vendor_payable: safeNumber(kpi.vendor_payable, 0),
            total_shipments: parseInt(kpi.total_shipments, 10) || 0,
            completed_shipments: parseInt(kpi.completed_shipments, 10) || 0,
            pending_shipments: parseInt(kpi.pending_shipments, 10) || 0,
            todays_collection: safeNumber(coll.todays_collection, 0),
            monthly_collection: safeNumber(coll.monthly_collection, 0),
            total_expense: fyExpense,
            fy_expense_count: fyExpenseCount,
            fy_label: curFYLabel,
            top_clients: (topClients || []).map(c => ({
                ...c,
                billed: safeNumber(c.billed, 0),
                received: safeNumber(c.received, 0)
            })),
            recent_payments: (recentPayments || []).map(p => ({
                ...p,
                payment_date: normalizeDateOnly(p.payment_date),
                amount: safeNumber(p.amount, 0)
            }))
        });
    } catch (err) {
        console.error('KPI Fetch Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getKPIs };
