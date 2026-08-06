/* ==========================================================================
   AKASHA LOGITRANS LLP - LEDGER & MULTI-INSTALLMENT PAYMENTS CONTROLLER
   Enterprise Transaction History Engine, Vendor Purchases, & Profit Ledger
   ========================================================================== */

const pool = require('../config/db');

function cleanId(param) {
    if (!param) return '';
    return decodeURIComponent(param).replace(/^\//, '');
}

function formatDate(d) {
    if (!d || typeof d !== 'string' || !d.trim() || d === 'null' || d === 'undefined') {
        return new Date().toISOString().split('T')[0];
    }
    return d.trim();
}

// Recalculates shipment payment totals atomically based on payment_transactions table
async function syncShipmentPaymentTotals(shipmentId) {
    const [shpRows] = await pool.execute(`SELECT sale_amount FROM shipments WHERE id = ?`, [shipmentId]);
    if (!shpRows || shpRows.length === 0) return;

    const saleAmt = parseFloat(shpRows[0].sale_amount) || 0;

    const [txRows] = await pool.execute(
        `SELECT COALESCE(SUM(amount), 0) AS total_rec, MAX(payment_date) AS last_date FROM payment_transactions WHERE shipment_id = ?`,
        [shipmentId]
    );

    const rawTotalRec = txRows ? parseFloat(txRows[0].total_rec) || 0 : 0;
    const lastDate = txRows && txRows[0].last_date ? txRows[0].last_date : new Date().toISOString().split('T')[0];
    
    const cappedRecAmt = Math.min(saleAmt, Math.max(0, rawTotalRec));
    const remBal = Math.max(0, saleAmt - cappedRecAmt);
    const status = cappedRecAmt >= saleAmt && saleAmt > 0 ? 'Completed' : (cappedRecAmt > 0 ? 'Partially Paid' : 'Pending');

    await pool.execute(
        `UPDATE shipments SET received_amount = ?, remaining_balance = ?, sale_status = ?, payment_receive_date = ? WHERE id = ?`,
        [cappedRecAmt, remBal, status, lastDate, shipmentId]
    );

    return { received_amount: cappedRecAmt, remaining_balance: remBal, sale_status: status };
}

// 1. GET PAYMENTS RECEIVED REGISTER
async function getPaymentsReceived(req, res) {
    try {
        const sql = `
            SELECT 
                s.id AS shipment_id,
                s.client_id,
                s.company_name,
                s.payment_receive_date,
                s.sale_amount,
                s.received_amount,
                s.remaining_balance AS balance_amount,
                s.sale_status,
                COUNT(pt.id) AS transaction_count
            FROM shipments s
            LEFT JOIN payment_transactions pt ON s.id = pt.shipment_id
            GROUP BY s.id, s.client_id, s.company_name, s.payment_receive_date, s.sale_amount, s.received_amount, s.remaining_balance, s.sale_status, s.created_at
            ORDER BY s.created_at DESC
        `;
                     
        const [rows] = await pool.execute(sql);
        const sanitized = (rows || []).map(p => {
            const saleAmt = parseFloat(p.sale_amount) || 0;
            const recAmt = Math.min(saleAmt, Math.max(0, parseFloat(p.received_amount) || 0));
            const balAmt = Math.max(0, saleAmt - recAmt);
            const status = recAmt >= saleAmt && saleAmt > 0 ? 'Completed' : (recAmt > 0 ? 'Partially Paid' : 'Pending');
            return {
                ...p,
                sale_amount: saleAmt,
                received_amount: recAmt,
                balance_amount: balAmt,
                sale_status: status
            };
        });

        return res.json(sanitized);
    } catch (err) {
        console.error('Get Payments Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 2. GET PAYMENT TRANSACTIONS TIMELINE FOR A SHIPMENT
async function getPaymentTransactions(req, res) {
    try {
        const shpId = cleanId(req.params.id || req.params[0] || req.query.shipment_id);
        if (!shpId) return res.status(400).json({ success: false, message: 'Shipment ID is required' });

        const [txs] = await pool.execute(
            `SELECT * FROM payment_transactions WHERE shipment_id = ? ORDER BY payment_date DESC, id DESC`,
            [shpId]
        );

        return res.json(txs || []);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. ADD NEW PAYMENT TRANSACTION (Multi-Installment Incremental Entry)
async function addPaymentTransaction(req, res) {
    try {
        const { shipment_id, payment_date, amount, payment_mode, bank, utr, remarks, created_by } = req.body;
        const shpId = cleanId(shipment_id || req.params.id);

        if (!shpId) return res.status(400).json({ success: false, message: 'Shipment ID is required.' });

        const payAmt = parseFloat(amount) || 0;
        if (payAmt <= 0 || isNaN(payAmt)) {
            return res.status(400).json({ success: false, message: 'Payment amount must be greater than ₹0.' });
        }

        // Fetch shipment record for backend overflow validation
        const [shps] = await pool.execute(`SELECT sale_amount, received_amount FROM shipments WHERE id = ?`, [shpId]);
        if (!shps || shps.length === 0) {
            return res.status(404).json({ success: false, message: 'Shipment not found.' });
        }

        const saleAmt = parseFloat(shps[0].sale_amount) || 0;
        const currentRec = Math.min(saleAmt, Math.max(0, parseFloat(shps[0].received_amount) || 0));
        const remBal = Math.max(0, saleAmt - currentRec);

        if (payAmt > remBal) {
            return res.status(400).json({
                success: false,
                message: `Payment overflow error! Maximum payable remaining today is ₹${remBal.toLocaleString('en-IN')} (Total Invoice: ₹${saleAmt.toLocaleString('en-IN')}).`
            });
        }

        const payDate = formatDate(payment_date);
        const modeStr = payment_mode ? payment_mode.trim() : 'Bank Transfer';
        const bankStr = bank ? bank.trim() : 'HDFC Bank';
        const utrStr = utr ? utr.trim() : '';
        const remarksStr = remarks ? remarks.trim() : 'Payment installment received';
        const userStr = created_by ? created_by.trim() : (req.user ? req.user.name : 'Director');

        await pool.execute(
            `INSERT INTO payment_transactions (shipment_id, payment_date, amount, payment_mode, bank, utr, remarks, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [shpId, payDate, payAmt, modeStr, bankStr, utrStr, remarksStr, userStr]
        );

        // Sync totals atomically
        const updatedTotals = await syncShipmentPaymentTotals(shpId);

        return res.json({
            success: true,
            message: `Payment installment of ₹${payAmt.toLocaleString('en-IN')} added successfully for ${shpId}.`,
            totals: updatedTotals
        });
    } catch (err) {
        console.error('Add Payment Transaction Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. UPDATE EXISTING PAYMENT TRANSACTIONS & RECALCULATE TOTALS
async function updatePaymentReceived(req, res) {
    try {
        const shpId = cleanId(req.params.id || req.params[0]);
        const { received_amount, payment_receive_date, payment_mode, bank, utr, remarks } = req.body;

        if (!shpId) return res.status(400).json({ success: false, message: 'Shipment ID is required.' });

        const [rows] = await pool.execute('SELECT sale_amount FROM shipments WHERE id = ?', [shpId]);
        if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Shipment record not found.' });

        const saleAmt = parseFloat(rows[0].sale_amount) || 0;
        const requestedRecAmt = parseFloat(received_amount) || 0;
        const recAmt = Math.min(saleAmt, Math.max(0, requestedRecAmt));
        const remBal = Math.max(0, saleAmt - recAmt);
        const status = recAmt >= saleAmt && saleAmt > 0 ? 'Completed' : (recAmt > 0 ? 'Partially Paid' : 'Pending');
        const currentDate = formatDate(payment_receive_date);

        // Wipe old transactions for this shipment and replace with updated transaction record
        await pool.execute(`DELETE FROM payment_transactions WHERE shipment_id = ?`, [shpId]);
        if (recAmt > 0) {
            await pool.execute(
                `INSERT INTO payment_transactions (shipment_id, payment_date, amount, payment_mode, bank, utr, remarks, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [shpId, currentDate, recAmt, payment_mode || 'Bank Transfer', bank || 'HDFC Bank', utr || '', remarks || 'Updated total received', req.user ? req.user.name : 'Director']
            );
        }

        const sql = `UPDATE shipments SET received_amount = ?, remaining_balance = ?, payment_receive_date = ?, sale_status = ? WHERE id = ?`;
        await pool.execute(sql, [recAmt, remBal, currentDate, status, shpId]);

        return res.json({
            success: true,
            message: 'Payment updated successfully',
            received_amount: recAmt,
            remaining_balance: remBal,
            sale_status: status
        });
    } catch (err) {
        console.error('Update Payment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 5. DELETE PAYMENT TRANSACTION
async function deletePaymentTransaction(req, res) {
    try {
        const txId = req.params.txId || req.params.id;
        if (!txId) return res.status(400).json({ success: false, message: 'Transaction ID required.' });

        const [txs] = await pool.execute(`SELECT shipment_id FROM payment_transactions WHERE id = ?`, [txId]);
        if (!txs || txs.length === 0) return res.status(404).json({ success: false, message: 'Transaction not found.' });

        const shpId = txs[0].shipment_id;
        await pool.execute(`DELETE FROM payment_transactions WHERE id = ?`, [txId]);

        const updatedTotals = await syncShipmentPaymentTotals(shpId);

        return res.json({
            success: true,
            message: 'Payment transaction deleted successfully.',
            totals: updatedTotals
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 6. GET PURCHASE LEDGER (Vendor-wise Breakdown & Outstanding Vendor Balance)
async function getPurchases(req, res) {
    try {
        const sql = `
            SELECT 
                id AS shipment_id, 
                client_id, 
                company_name, 
                line_name,
                transport_name,
                purchase_date, 
                purchase_amount, 
                purchase_status,
                purchase_items
            FROM shipments 
            ORDER BY created_at DESC
        `;
        const [rows] = await pool.execute(sql);
        return res.json(rows || []);
    } catch (err) {
        console.error('Get Purchases Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 7. GET PROFIT LEDGER (Month-wise, Client-wise, Gross Margin & Net Profit Metrics)
async function getProfitLedger(req, res) {
    try {
        const sql = `
            SELECT 
                id AS shipment_id, 
                date,
                client_id, 
                company_name, 
                purchase_amount, 
                sale_amount, 
                net_profit,
                sale_status
            FROM shipments 
            ORDER BY created_at DESC
        `;
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

module.exports = {
    getPaymentsReceived,
    getPaymentTransactions,
    addPaymentTransaction,
    updatePaymentReceived,
    deletePaymentTransaction,
    getPurchases,
    getProfitLedger
};
