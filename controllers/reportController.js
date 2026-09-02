/* ==========================================================================
   AKASHA LOGITRANS LLP - REPORTS CONTROLLER
   Server-side aggregation for Receivables, Payables, Profit, GST & Monthly Ledger
   Powered by Central Financial Report Service & Date Utilities
   ========================================================================== */

const pool = require('../config/db');
const { safeNumber, calculateSaleItems, calculatePurchaseItems } = require('../utils/financialUtils');
const { normalizeDateOnly, getDaysOutstanding } = require('../utils/dateUtils');
const { 
    getAuthoritativeShipmentProfitRows, 
    aggregateMonthWiseProfit, 
    aggregateFinancialYearWiseProfit,
    getConsolidatedProfitReport 
} = require('../services/financialReportService');

// 1. RECEIVABLE REPORT
async function getReceivableReport(req, res) {
    try {
        const { client_id, month, search } = req.query;
        let sql = `
            SELECT 
                s.id, s.date, s.client_id, s.company_name, s.payment_receive_date,
                s.sale_amount, s.received_amount, s.remaining_balance, s.sale_status,
                COALESCE(c.opening_balance, 0) AS opening_balance,
                COALESCE(pt.total_rec, 0) AS total_customer_received
            FROM shipments s
            LEFT JOIN clients c ON (s.client_id COLLATE utf8mb4_general_ci) = (c.id COLLATE utf8mb4_general_ci)
            LEFT JOIN (
                SELECT shipment_id, SUM(amount) AS total_rec 
                FROM payment_transactions 
                GROUP BY shipment_id
            ) pt ON (s.id COLLATE utf8mb4_general_ci) = (pt.shipment_id COLLATE utf8mb4_general_ci)
            WHERE 1=1
        `;
        const params = [];

        if (client_id) {
            sql += ` AND s.client_id = ?`;
            params.push(client_id);
        }
        if (month) {
            sql += ` AND DATE_FORMAT(s.date, '%Y-%m') = ?`;
            params.push(month);
        }
        if (search) {
            sql += ` AND (s.id LIKE ? OR s.company_name LIKE ? OR s.client_id LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q);
        }

        sql += ` ORDER BY s.date DESC, s.id DESC`;
        const [rows] = await pool.execute(sql, params);

        const report = (rows || []).map(r => {
            const saleAmt = safeNumber(r.sale_amount, 0);
            const recAmt = Math.min(saleAmt, Math.max(0, safeNumber(r.total_customer_received, safeNumber(r.received_amount, 0))));
            const balAmt = Math.max(0, saleAmt - recAmt);
            const dateStr = normalizeDateOnly(r.date);
            const days = getDaysOutstanding(dateStr);
            const status = balAmt === 0 && saleAmt > 0 ? 'PAID' : (days > 30 && balAmt > 0 ? 'OVERDUE' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID'));

            return {
                shipment_id: r.id,
                client_id: r.client_id || '',
                company_name: r.company_name || '',
                client_opening_balance: safeNumber(r.opening_balance, 0),
                invoice_date: dateStr,
                due_date: r.payment_receive_date ? normalizeDateOnly(r.payment_receive_date) : dateStr,
                invoice_amount: saleAmt,
                received_amount: recAmt,
                balance_amount: balAmt,
                days_outstanding: days,
                status
            };
        });

        return res.json(report);
    } catch (err) {
        console.error('Receivable Report Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 2. PAYABLE REPORT
async function getPayableReport(req, res) {
    try {
        const { vendor_id, month, search } = req.query;
        let sql = `
            SELECT 
                s.id, s.date, s.purchase_date, s.line_name, s.transport_name,
                s.purchase_amount, s.purchase_status,
                COALESCE(vp.total_paid, 0) AS total_vendor_paid
            FROM shipments s
            LEFT JOIN (
                SELECT shipment_id, SUM(amount) AS total_paid 
                FROM vendor_payments 
                GROUP BY shipment_id
            ) vp ON (s.id COLLATE utf8mb4_general_ci) = (vp.shipment_id COLLATE utf8mb4_general_ci)
            WHERE 1=1
        `;
        const params = [];

        if (month) {
            sql += ` AND DATE_FORMAT(s.date, '%Y-%m') = ?`;
            params.push(month);
        }
        if (search) {
            sql += ` AND (s.id LIKE ? OR s.line_name LIKE ? OR s.transport_name LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q);
        }

        sql += ` ORDER BY s.date DESC, s.id DESC`;
        const [rows] = await pool.execute(sql, params);

        const report = (rows || []).map(r => {
            const purAmt = safeNumber(r.purchase_amount, 0);
            const paidAmt = Math.min(purAmt, Math.max(0, safeNumber(r.total_vendor_paid, 0)));
            const balAmt = Math.max(0, purAmt - paidAmt);
            const billDate = normalizeDateOnly(r.purchase_date || r.date);
            const days = getDaysOutstanding(billDate);
            const status = balAmt === 0 && purAmt > 0 ? 'PAID' : (days > 30 && balAmt > 0 ? 'OVERDUE' : (paidAmt > 0 ? 'PARTIAL' : 'UNPAID'));

            return {
                shipment_id: r.id,
                vendor_name: r.line_name || r.transport_name || 'Vendor',
                bill_date: billDate,
                due_date: billDate,
                bill_amount: purAmt,
                paid_amount: paidAmt,
                balance_amount: balAmt,
                days_outstanding: days,
                status
            };
        });

        return res.json(report);
    } catch (err) {
        console.error('Payable Report Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. PROFIT REPORT (Unified Single Source of Truth)
async function getProfitReport(req, res) {
    try {
        const { month, year, client_id, format } = req.query;
        const report = await getConsolidatedProfitReport({ month, year, client_id });

        // If explicitly requested as structured object with summary
        if (format === 'structured' || req.query.structured === 'true') {
            return res.json(report);
        }

        // Default backward-compatible array return for legacy UI callers while attaching metadata
        const dataArr = report.data || [];
        return res.json(dataArr);
    } catch (err) {
        console.error('Profit Report Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. GST REPORT (Item-level based or standard calculation)
async function getGstReport(req, res) {
    try {
        const { month } = req.query;
        let sql = `SELECT * FROM shipments WHERE 1=1`;
        const params = [];

        if (month) {
            sql += ` AND DATE_FORMAT(date, '%Y-%m') = ?`;
            params.push(month);
        }

        const [rows] = await pool.execute(sql, params);

        let totalTaxableSales = 0;
        let totalOutputGst = 0;
        let totalTaxablePurchase = 0;
        let totalInputGst = 0;

        (rows || []).forEach(r => {
            const saleCalc = calculateSaleItems(r.sale_items);
            const purCalc = calculatePurchaseItems(r.purchase_items);

            let rowTaxableSale = 0;
            let rowOutputGst = 0;
            if (saleCalc.items && saleCalc.items.length > 0) {
                saleCalc.items.forEach(it => {
                    rowTaxableSale += safeNumber(it.taxable, 0);
                    rowOutputGst += safeNumber(it.gst_amt, 0);
                });
            } else {
                const saleAmt = safeNumber(r.sale_amount, 0);
                rowTaxableSale = saleAmt > 0 ? (saleAmt / 1.18) : 0;
                rowOutputGst = saleAmt - rowTaxableSale;
            }

            let rowTaxablePur = 0;
            let rowInputGst = 0;
            if (purCalc.items && purCalc.items.length > 0) {
                purCalc.items.forEach(it => {
                    rowTaxablePur += safeNumber(it.taxable, 0);
                    rowInputGst += safeNumber(it.gst_amt, 0);
                });
            } else {
                const purAmt = safeNumber(r.purchase_amount, 0);
                rowTaxablePur = purAmt > 0 ? (purAmt / 1.18) : 0;
                rowInputGst = purAmt - rowTaxablePur;
            }

            totalTaxableSales += rowTaxableSale;
            totalOutputGst += rowOutputGst;
            totalTaxablePurchase += rowTaxablePur;
            totalInputGst += rowInputGst;
        });

        const netGstPayable = totalOutputGst - totalInputGst;

        return res.json({
            month: month || 'All Months',
            taxable_sales: Math.round(totalTaxableSales * 100) / 100,
            output_gst: Math.round(totalOutputGst * 100) / 100,
            taxable_purchase: Math.round(totalTaxablePurchase * 100) / 100,
            input_gst: Math.round(totalInputGst * 100) / 100,
            net_gst_position: Math.round(netGstPayable * 100) / 100
        });
    } catch (err) {
        console.error('GST Report Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 5. MONTHLY LEDGER (Authoritative Chronological Aggregation)
async function getMonthlyLedger(req, res) {
    try {
        const shipmentRows = await getAuthoritativeShipmentProfitRows();
        const monthWise = aggregateMonthWiseProfit(shipmentRows);

        const result = monthWise.map(m => ({
            month: m.month_key,
            month_label: m.month_label,
            sales: m.total_sales,
            purchase: m.total_purchase,
            direct_expenses: m.total_direct_expenses,
            profit: m.net_profit,
            margin_pct: m.margin_pct,
            shipment_count: m.shipment_count
        }));

        return res.json(result);
    } catch (err) {
        console.error('Monthly Ledger Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getReceivableReport,
    getPayableReport,
    getProfitReport,
    getGstReport,
    getMonthlyLedger
};
