/* ==========================================================================
   AKASHA LOGITRANS LLP - REPORTS CONTROLLER
   Server-side aggregation for Receivables, Payables, Profit, GST & Monthly Ledger
   ========================================================================== */

const pool = require('../config/db');

// Helper: Calculate days between dates
function getDaysOutstanding(dateStr) {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const now = new Date();
    const diffTime = now - d;
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

// 1. RECEIVABLE REPORT
async function getReceivableReport(req, res) {
    try {
        const { client_id, month, search } = req.query;
        let sql = `SELECT * FROM shipments WHERE 1=1`;
        const params = [];

        if (client_id) {
            sql += ` AND client_id = ?`;
            params.push(client_id);
        }
        if (month) {
            sql += ` AND DATE_FORMAT(date, '%Y-%m') = ?`;
            params.push(month);
        }
        if (search) {
            sql += ` AND (id LIKE ? OR company_name LIKE ? OR client_id LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q);
        }

        sql += ` ORDER BY date DESC`;
        const [rows] = await pool.execute(sql, params);

        const report = (rows || []).map(r => {
            const saleAmt = parseFloat(r.sale_amount) || 0;
            const recAmt = Math.min(saleAmt, Math.max(0, parseFloat(r.received_amount) || 0));
            const balAmt = Math.max(0, saleAmt - recAmt);
            const days = getDaysOutstanding(r.date);
            const status = balAmt === 0 && saleAmt > 0 ? 'PAID' : (days > 30 && balAmt > 0 ? 'OVERDUE' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID'));

            return {
                shipment_id: r.id,
                client_id: r.client_id || '',
                company_name: r.company_name || '',
                invoice_date: r.date,
                due_date: r.payment_receive_date || r.date,
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
        let sql = `SELECT * FROM shipments WHERE 1=1`;
        const params = [];

        if (month) {
            sql += ` AND DATE_FORMAT(date, '%Y-%m') = ?`;
            params.push(month);
        }
        if (search) {
            sql += ` AND (id LIKE ? OR line_name LIKE ? OR transport_name LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q);
        }

        sql += ` ORDER BY date DESC`;
        const [rows] = await pool.execute(sql, params);

        // Fetch vendor payments
        const [vpRows] = await pool.execute(`SELECT shipment_id, COALESCE(SUM(amount), 0) as paid FROM vendor_payments GROUP BY shipment_id`);
        const vpMap = {};
        (vpRows || []).forEach(v => { vpMap[v.shipment_id] = parseFloat(v.paid) || 0; });

        const report = (rows || []).map(r => {
            const purAmt = parseFloat(r.purchase_amount) || 0;
            const paidAmt = vpMap[r.id] || (r.purchase_status === 'PAID' ? purAmt : 0);
            const balAmt = Math.max(0, purAmt - paidAmt);
            const days = getDaysOutstanding(r.purchase_date || r.date);
            const status = balAmt === 0 && purAmt > 0 ? 'PAID' : (days > 30 && balAmt > 0 ? 'OVERDUE' : (paidAmt > 0 ? 'PARTIAL' : 'UNPAID'));

            return {
                shipment_id: r.id,
                vendor_name: r.line_name || r.transport_name || 'Vendor',
                bill_date: r.purchase_date || r.date,
                due_date: r.purchase_date || r.date,
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

// 3. PROFIT REPORT
async function getProfitReport(req, res) {
    try {
        const { month, year, client_id } = req.query;
        let sql = `SELECT * FROM shipments WHERE 1=1`;
        const params = [];

        if (month) {
            sql += ` AND DATE_FORMAT(date, '%Y-%m') = ?`;
            params.push(month);
        }
        if (year) {
            sql += ` AND DATE_FORMAT(date, '%Y') = ?`;
            params.push(year);
        }
        if (client_id) {
            sql += ` AND client_id = ?`;
            params.push(client_id);
        }

        sql += ` ORDER BY date DESC`;
        const [rows] = await pool.execute(sql, params);

        const report = (rows || []).map(r => {
            const saleAmt = parseFloat(r.sale_amount) || 0;
            const purAmt = parseFloat(r.purchase_amount) || 0;
            const profit = saleAmt - purAmt;
            const margin = saleAmt > 0 ? ((profit / saleAmt) * 100).toFixed(2) : 0;

            return {
                shipment_id: r.id,
                date: r.date,
                client_id: r.client_id || '',
                company_name: r.company_name || '',
                sales_amount: saleAmt,
                purchase_amount: purAmt,
                net_profit: profit,
                margin_pct: parseFloat(margin)
            };
        });

        return res.json(report);
    } catch (err) {
        console.error('Profit Report Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. GST REPORT
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
            const saleAmt = parseFloat(r.sale_amount) || 0;
            const purAmt = parseFloat(r.purchase_amount) || 0;

            // 18% GST calculation model
            const taxableSale = saleAmt / 1.18;
            const outputGst = saleAmt - taxableSale;

            const taxablePur = purAmt / 1.18;
            const inputGst = purAmt - taxablePur;

            totalTaxableSales += taxableSale;
            totalOutputGst += outputGst;
            totalTaxablePurchase += taxablePur;
            totalInputGst += inputGst;
        });

        const netGstPayable = totalOutputGst - totalInputGst;

        return res.json({
            month: month || 'All Months',
            taxable_sales: Math.round(totalTaxableSales),
            output_gst: Math.round(totalOutputGst),
            taxable_purchase: Math.round(totalTaxablePurchase),
            input_gst: Math.round(totalInputGst),
            net_gst_position: Math.round(netGstPayable)
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 5. MONTHLY LEDGER
async function getMonthlyLedger(req, res) {
    try {
        const [rows] = await pool.execute(`SELECT * FROM shipments ORDER BY date ASC`);

        const monthlyData = {};
        const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
        const currentYear = new Date().getFullYear();

        months.forEach(m => {
            const key = `${currentYear}-${m}`;
            monthlyData[key] = { month: key, sales: 0, purchase: 0, received: 0, paid: 0, profit: 0 };
        });

        (rows || []).forEach(r => {
            const key = r.date ? r.date.substring(0, 7) : `${currentYear}-08`;
            if (!monthlyData[key]) {
                monthlyData[key] = { month: key, sales: 0, purchase: 0, received: 0, paid: 0, profit: 0 };
            }
            const s = parseFloat(r.sale_amount) || 0;
            const p = parseFloat(r.purchase_amount) || 0;
            const rec = parseFloat(r.received_amount) || 0;

            monthlyData[key].sales += s;
            monthlyData[key].purchase += p;
            monthlyData[key].received += rec;
            monthlyData[key].profit += (s - p);
        });

        return res.json(Object.values(monthlyData));
    } catch (err) {
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
