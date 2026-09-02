/* ==========================================================================
   AKASHA LOGITRANS LLP - CENTRAL FINANCIAL REPORT SERVICE
   Authoritative Multi-dimensional Aggregator for Profit, Margin, & Ledger Views
   ========================================================================== */

const pool = require('../config/db');
const { safeNumber, calculateNetProfit, calculateMarginPercentage, calculateSummaryMetrics } = require('../utils/financialUtils');
const { normalizeDateOnly, calculateFinancialYear, getMonthKeyAndLabel } = require('../utils/dateUtils');

/**
 * Fetches all base shipment rows with aggregated direct expenses, customer payments, and vendor payments.
 * Prevents multiplication of rows by aggregating 1-to-many tables before joining.
 * @param {Object} filters - { month, year, client_id, search }
 * @returns {Promise<Array>} Normalized shipment profit rows.
 */
async function getAuthoritativeShipmentProfitRows(filters = {}) {
    const { month, year, client_id, search } = filters;

    let sql = `
        SELECT 
            s.id,
            s.date,
            s.client_id,
            s.company_name,
            s.line_name,
            s.transport_name,
            s.sb_be_no,
            s.shipment_type,
            s.sale_amount,
            s.purchase_amount,
            s.received_amount,
            s.remaining_balance,
            s.sale_status,
            s.purchase_status,
            s.created_at,
            COALESCE(exp.total_direct_exp, 0) AS direct_expense_amount,
            COALESCE(vp.total_vendor_paid, 0) AS paid_amount,
            COALESCE(pt.total_cust_rec, 0) AS total_customer_received
        FROM shipments s
        LEFT JOIN (
            SELECT shipment_id, SUM(amount) AS total_direct_exp 
            FROM expenses 
            WHERE shipment_id IS NOT NULL AND shipment_id != ''
            GROUP BY shipment_id
        ) exp ON (s.id COLLATE utf8mb4_general_ci) = (exp.shipment_id COLLATE utf8mb4_general_ci)
        LEFT JOIN (
            SELECT shipment_id, SUM(amount) AS total_vendor_paid 
            FROM vendor_payments 
            GROUP BY shipment_id
        ) vp ON (s.id COLLATE utf8mb4_general_ci) = (vp.shipment_id COLLATE utf8mb4_general_ci)
        LEFT JOIN (
            SELECT shipment_id, SUM(amount) AS total_cust_rec 
            FROM payment_transactions 
            GROUP BY shipment_id
        ) pt ON (s.id COLLATE utf8mb4_general_ci) = (pt.shipment_id COLLATE utf8mb4_general_ci)
        WHERE 1=1
    `;
    const params = [];

    if (month) {
        sql += ` AND DATE_FORMAT(s.date, '%Y-%m') = ?`;
        params.push(month);
    }
    if (year) {
        sql += ` AND DATE_FORMAT(s.date, '%Y') = ?`;
        params.push(year);
    }
    if (client_id) {
        sql += ` AND s.client_id = ?`;
        params.push(client_id);
    }
    if (search) {
        sql += ` AND (s.id LIKE ? OR s.company_name LIKE ? OR s.client_id LIKE ? OR s.line_name LIKE ?)`;
        const q = `%${search.trim()}%`;
        params.push(q, q, q, q);
    }

    sql += ` ORDER BY s.date DESC, s.id DESC`;

    const [rows] = await pool.execute(sql, params);

    return (rows || []).map(r => {
        const saleAmt = safeNumber(r.sale_amount, 0);
        const purAmt = safeNumber(r.purchase_amount, 0);
        const directExp = safeNumber(r.direct_expense_amount, 0);
        const profit = calculateNetProfit(saleAmt, purAmt, directExp);
        const margin = calculateMarginPercentage(saleAmt, profit);

        // Payment status & balances (cash flow values)
        const recAmt = Math.min(saleAmt, Math.max(safeNumber(r.total_customer_received, 0), safeNumber(r.received_amount, 0)));
        const remBal = Math.max(0, saleAmt - recAmt);
        const custStatus = r.sale_status || (recAmt >= saleAmt && saleAmt > 0 ? 'PAID' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID'));

        const paidAmt = Math.min(purAmt, Math.max(0, safeNumber(r.paid_amount, 0)));
        const balPay = Math.max(0, purAmt - paidAmt);
        const vendStatus = r.purchase_status || (paidAmt >= purAmt && purAmt > 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'UNPAID'));

        const dateStr = normalizeDateOnly(r.date);
        const fy = calculateFinancialYear(dateStr);
        const monthInfo = getMonthKeyAndLabel(dateStr);

        return {
            shipment_id: r.id,
            id: r.id,
            date: dateStr,
            client_id: r.client_id || '',
            company_name: r.company_name || '',
            line_name: r.line_name || '',
            transport_name: r.transport_name || '',
            sb_be_no: r.sb_be_no || '',
            shipment_type: r.shipment_type || 'EXPORT FCL',
            sales_amount: saleAmt,
            sale_amount: saleAmt,
            purchase_amount: purAmt,
            direct_expense_amount: directExp,
            net_profit: profit,
            margin_pct: margin,
            received_amount: recAmt,
            remaining_balance: remBal,
            customer_status: custStatus,
            sale_status: custStatus,
            paid_amount: paidAmt,
            balance_payable: balPay,
            vendor_status: vendStatus,
            purchase_status: vendStatus,
            financial_year: fy,
            month_key: monthInfo.monthKey,
            month_label: monthInfo.monthLabel
        };
    });
}

/**
 * Generates Month-Wise Profit Aggregations from authoritative shipment rows.
 * @param {Array} shipmentRows - Output of getAuthoritativeShipmentProfitRows.
 * @returns {Array} Month-wise grouped records sorted chronologically.
 */
function aggregateMonthWiseProfit(shipmentRows = []) {
    const monthMap = {};

    for (const r of shipmentRows) {
        const ym = r.month_key;
        if (!ym || ym === 'Unspecified') continue;

        if (!monthMap[ym]) {
            monthMap[ym] = {
                month_key: ym,
                month_label: r.month_label,
                shipment_count: 0,
                total_sales: 0,
                total_purchase: 0,
                total_direct_expenses: 0,
                net_profit: 0,
                margin_pct: 0,
                financial_year: r.financial_year
            };
        }

        monthMap[ym].shipment_count += 1;
        monthMap[ym].total_sales += r.sales_amount;
        monthMap[ym].total_purchase += r.purchase_amount;
        monthMap[ym].total_direct_expenses += r.direct_expense_amount;
        monthMap[ym].net_profit += r.net_profit;
    }

    // Chronological order (oldest to newest for graphs, but API can return newest first)
    const sorted = Object.values(monthMap).sort((a, b) => b.month_key.localeCompare(a.month_key));

    return sorted.map(m => ({
        ...m,
        total_sales: Math.round(m.total_sales * 100) / 100,
        total_purchase: Math.round(m.total_purchase * 100) / 100,
        total_direct_expenses: Math.round(m.total_direct_expenses * 100) / 100,
        net_profit: Math.round(m.net_profit * 100) / 100,
        margin_pct: calculateMarginPercentage(m.total_sales, m.net_profit)
    }));
}

/**
 * Generates Financial Year-Wise Profit Aggregations from authoritative shipment rows.
 * @param {Array} shipmentRows - Output of getAuthoritativeShipmentProfitRows.
 * @returns {Array} FY-wise grouped records sorted newest to oldest.
 */
function aggregateFinancialYearWiseProfit(shipmentRows = []) {
    const fyMap = {};

    for (const r of shipmentRows) {
        const fy = r.financial_year;
        if (!fy) continue;

        if (!fyMap[fy]) {
            fyMap[fy] = {
                financial_year: fy,
                shipment_count: 0,
                total_sales: 0,
                total_purchase: 0,
                total_direct_expenses: 0,
                net_profit: 0,
                margin_pct: 0
            };
        }

        fyMap[fy].shipment_count += 1;
        fyMap[fy].total_sales += r.sales_amount;
        fyMap[fy].total_purchase += r.purchase_amount;
        fyMap[fy].total_direct_expenses += r.direct_expense_amount;
        fyMap[fy].net_profit += r.net_profit;
    }

    const sorted = Object.values(fyMap).sort((a, b) => b.financial_year.localeCompare(a.financial_year));

    return sorted.map(f => ({
        ...f,
        total_sales: Math.round(f.total_sales * 100) / 100,
        total_purchase: Math.round(f.total_purchase * 100) / 100,
        total_direct_expenses: Math.round(f.total_direct_expenses * 100) / 100,
        net_profit: Math.round(f.net_profit * 100) / 100,
        margin_pct: calculateMarginPercentage(f.total_sales, f.net_profit)
    }));
}

/**
 * Full consolidated profit report handler.
 * @param {Object} filters - Filter criteria.
 * @returns {Promise<Object>} Structured report with summary, shipments, months, and years.
 */
async function getConsolidatedProfitReport(filters = {}) {
    const shipmentRows = await getAuthoritativeShipmentProfitRows(filters);
    const summary = calculateSummaryMetrics(shipmentRows);
    const monthWise = aggregateMonthWiseProfit(shipmentRows);
    const yearWise = aggregateFinancialYearWiseProfit(shipmentRows);

    return {
        success: true,
        summary,
        data: shipmentRows,
        shipments: shipmentRows,
        month_wise: monthWise,
        year_wise: yearWise
    };
}

module.exports = {
    getAuthoritativeShipmentProfitRows,
    aggregateMonthWiseProfit,
    aggregateFinancialYearWiseProfit,
    getConsolidatedProfitReport
};
