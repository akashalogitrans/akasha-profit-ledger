/* ==========================================================================
   AKASHA LOGITRANS LLP - LEDGER & PAYMENTS CONTROLLER
   ========================================================================== */

const pool = require('../config/db');

function cleanId(param) {
    if (!param) return '';
    return decodeURIComponent(param).replace(/^\//, '');
}

async function getPaymentsReceived(req, res) {
    try {
        const sql = `SELECT id AS shipment_id, client_id, company_name, payment_receive_date, sale_amount, 
                     COALESCE(received_amount, CASE WHEN sale_status = 'Completed' THEN sale_amount ELSE 0 END) AS received_amount,
                     CASE 
                         WHEN sale_status = 'Completed' THEN 0
                         WHEN COALESCE(received_amount, 0) > 0 THEN (sale_amount - received_amount)
                         ELSE sale_amount
                     END AS balance_amount, 
                     sale_status 
                     FROM shipments ORDER BY created_at DESC`;
                     
        const [rows] = await pool.execute(sql);
        return res.json(rows || []);
    } catch (err) {
        console.error('Get Payments Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function updatePaymentReceived(req, res) {
    try {
        const rawParam = req.params.id || req.params[0];
        const shpId = cleanId(rawParam);
        const { received_amount, payment_receive_date } = req.body;

        if (!shpId) {
            return res.status(400).json({ success: false, message: 'Shipment ID is required' });
        }

        const [rows] = await pool.execute('SELECT sale_amount FROM shipments WHERE id = ?', [shpId]);
        const row = rows[0];

        if (!row) {
            return res.status(404).json({ success: false, message: 'Shipment record not found' });
        }

        const saleAmt = parseFloat(row.sale_amount) || 0;
        const requestedRecAmt = parseFloat(received_amount) || 0;
        const recAmt = Math.min(saleAmt, Math.max(0, requestedRecAmt));
        const status = recAmt >= saleAmt ? 'Completed' : (recAmt > 0 ? 'Partially Paid' : 'Pending');
        const currentDate = payment_receive_date || new Date().toISOString().split('T')[0];

        const sql = `UPDATE shipments SET received_amount = ?, payment_receive_date = ?, sale_status = ? WHERE id = ?`;
        await pool.execute(sql, [recAmt, currentDate, status, shpId]);

        return res.json({ success: true, message: 'Payment updated successfully', received_amount: recAmt, sale_status: status });
    } catch (err) {
        console.error('Update Payment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function getPurchases(req, res) {
    try {
        const sql = `SELECT id AS shipment_id, client_id, company_name, purchase_date, purchase_amount, purchase_status 
                     FROM shipments ORDER BY created_at DESC`;
        const [rows] = await pool.execute(sql);
        return res.json(rows || []);
    } catch (err) {
        console.error('Get Purchases Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function getProfitLedger(req, res) {
    try {
        const sql = `SELECT id AS shipment_id, client_id, company_name, purchase_amount, sale_amount, net_profit 
                     FROM shipments ORDER BY created_at DESC`;
        const [rows] = await pool.execute(sql);
        
        const list = (rows || []).map(r => {
            const sAmt = parseFloat(r.sale_amount) || 0;
            const pft = parseFloat(r.net_profit) || 0;
            const margin = sAmt > 0 ? ((pft / sAmt) * 100).toFixed(1) : "0.0";
            return { ...r, gross_margin: margin };
        });

        return res.json(list);
    } catch (err) {
        console.error('Get Profit Ledger Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getPaymentsReceived, updatePaymentReceived, getPurchases, getProfitLedger };
