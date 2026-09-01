/* ==========================================================================
   AKASHA LOGITRANS LLP - LEDGER & MULTI-INSTALLMENT PAYMENTS CONTROLLER
   Customer Payments Ledger, Auto Status Transitions & Transaction Audit Trail
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

// Recalculates shipment customer payment totals atomically
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
    const status = cappedRecAmt >= saleAmt && saleAmt > 0 ? 'PAID' : (cappedRecAmt > 0 ? 'PARTIAL' : 'UNPAID');

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
            LEFT JOIN payment_transactions pt ON (s.id COLLATE utf8mb4_general_ci) = (pt.shipment_id COLLATE utf8mb4_general_ci)
            GROUP BY s.id, s.client_id, s.company_name, s.payment_receive_date, s.sale_amount, s.received_amount, s.remaining_balance, s.sale_status, s.created_at
            ORDER BY s.created_at DESC
        `;
                     
        const [rows] = await pool.execute(sql);
        const sanitized = (rows || []).map(p => {
            const saleAmt = parseFloat(p.sale_amount) || 0;
            const recAmt = Math.min(saleAmt, Math.max(0, parseFloat(p.received_amount) || 0));
            const balAmt = Math.max(0, saleAmt - recAmt);
            const status = recAmt >= saleAmt && saleAmt > 0 ? 'PAID' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID');
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

// 3. RECORD NEW CUSTOMER PAYMENT
async function recordPayment(req, res) {
    try {
        const { shipment_id, payment_date, amount, payment_mode, bank, utr, remarks } = req.body;
        const shpId = cleanId(shipment_id);

        if (!shpId) {
            return res.status(400).json({ success: false, message: 'Shipment ID is required.' });
        }

        const pAmt = parseFloat(amount);
        if (isNaN(pAmt) || pAmt < 0) {
            return res.status(400).json({ success: false, message: 'Payment Amount must be a valid number greater than or equal to ₹0.' });
        }

        const [shpRows] = await pool.execute(`SELECT sale_amount, received_amount FROM shipments WHERE id = ?`, [shpId]);
        if (!shpRows || shpRows.length === 0) {
            return res.status(404).json({ success: false, message: `Shipment ${shpId} not found.` });
        }

        const saleAmt = parseFloat(shpRows[0].sale_amount) || 0;

        const [txRows] = await pool.execute(
            `SELECT COALESCE(SUM(amount), 0) AS total_rec FROM payment_transactions WHERE shipment_id = ?`,
            [shpId]
        );
        const currentRec = txRows ? parseFloat(txRows[0].total_rec) || 0 : 0;
        const remainingBal = Math.max(0, saleAmt - currentRec);

        if (pAmt > (remainingBal + 5.0) && remainingBal > 0) {
            return res.status(400).json({
                success: false,
                message: `Payment amount (₹${pAmt.toLocaleString('en-IN')}) exceeds remaining customer receivable balance (₹${remainingBal.toLocaleString('en-IN')}).`
            });
        }

        const createdBy = req.user ? req.user.name : 'Director';
        const payDate = formatDate(payment_date);

        await pool.execute(
            `INSERT INTO payment_transactions (shipment_id, payment_date, amount, payment_mode, bank, utr, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [shpId, payDate, pAmt, payment_mode || 'Bank Transfer', bank || 'HDFC Bank', utr || '', remarks || '', createdBy]
        );

        const syncResult = await syncShipmentPaymentTotals(shpId);

        return res.status(201).json({
            success: true,
            message: `Payment of ₹${pAmt.toLocaleString('en-IN')} recorded successfully for ${shpId}`,
            totals: syncResult
        });

    } catch (err) {
        console.error('Record Payment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. DELETE CUSTOMER PAYMENT
async function deletePaymentTransaction(req, res) {
    try {
        const txId = req.params.id;
        const [txRows] = await pool.execute(`SELECT shipment_id, amount FROM payment_transactions WHERE id = ?`, [txId]);
        if (!txRows || txRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Payment transaction record not found.' });
        }

        const shpId = txRows[0].shipment_id;
        await pool.execute(`DELETE FROM payment_transactions WHERE id = ?`, [txId]);

        const syncResult = await syncShipmentPaymentTotals(shpId);

        return res.json({
            success: true,
            message: 'Payment transaction deleted and shipment balance recalculated successfully.',
            totals: syncResult
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 5. RECORD CLIENT LUMP-SUM PAYMENT WITH FIFO AUTO-ADJUSTMENT ACROSS OUTSTANDING SHIPMENTS
async function recordClientLumpSumPayment(req, res) {
    try {
        const { client_id, company_name, payment_date, amount, payment_mode, bank, utr, remarks } = req.body;
        const cId = (client_id || '').trim();
        const cName = (company_name || '').trim();

        if (!cId && !cName) {
            return res.status(400).json({ success: false, message: 'Client ID or Company Name is required.' });
        }

        const totalPayment = parseFloat(amount);
        if (isNaN(totalPayment) || totalPayment < 0) {
            return res.status(400).json({ success: false, message: 'Received amount must be a valid number (₹0 or greater).' });
        }

        const payDate = formatDate(payment_date);
        const createdBy = req.user ? req.user.name : 'Director';

        // Fetch all shipments for this client ordered chronologically (FIFO: date ASC, id ASC)
        let query = `SELECT id, date, sale_amount, received_amount, remaining_balance, sale_status 
                     FROM shipments 
                     WHERE (client_id = ? OR LOWER(company_name) = LOWER(?))
                     ORDER BY date ASC, id ASC`;
        const [shpRows] = await pool.execute(query, [cId, cName]);

        if (!shpRows || shpRows.length === 0) {
            return res.status(404).json({ success: false, message: `No shipments found for client ${cId || cName}.` });
        }

        let unadjustedAmount = totalPayment;
        const adjustments = [];

        for (const s of shpRows) {
            if (unadjustedAmount <= 0) break;

            const saleAmt = parseFloat(s.sale_amount) || 0;
            // Get actual received amount from payment_transactions
            const [txRows] = await pool.execute(
                `SELECT COALESCE(SUM(amount), 0) AS total_rec FROM payment_transactions WHERE shipment_id = ?`,
                [s.id]
            );
            const currentRec = txRows ? parseFloat(txRows[0].total_rec) || 0 : 0;
            const dueBal = Math.max(0, saleAmt - currentRec);

            if (dueBal <= 0) continue; // Already fully paid

            // Amount to apply to this shipment
            const appliedAmt = Math.min(unadjustedAmount, dueBal);
            unadjustedAmount -= appliedAmt;

            // Insert transaction
            await pool.execute(
                `INSERT INTO payment_transactions (shipment_id, payment_date, amount, payment_mode, bank, utr, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [s.id, payDate, appliedAmt, payment_mode || 'Bank Transfer', bank || 'HDFC Bank', utr || '', remarks ? `${remarks} (Client Lump-sum Auto-adjusted)` : 'Client Lump-sum Auto-adjusted', createdBy]
            );

            // Sync shipment payment status & balance
            const syncResult = await syncShipmentPaymentTotals(s.id);

            adjustments.push({
                shipment_id: s.id,
                date: s.date,
                sale_amount: saleAmt,
                previous_received: currentRec,
                applied_payment: appliedAmt,
                new_balance: syncResult.remaining_balance,
                new_status: syncResult.sale_status
            });
        }

        let unappliedBalance = unadjustedAmount;

        return res.status(201).json({
            success: true,
            message: `Lump-sum payment of ₹${totalPayment.toLocaleString('en-IN')} auto-adjusted across ${adjustments.length} shipment(s) successfully!`,
            total_received: totalPayment,
            total_applied: totalPayment - unappliedBalance,
            unapplied_balance: unappliedBalance,
            adjustments
        });

    } catch (err) {
        console.error('Client Lump-Sum Payment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getPaymentsReceived,
    getPaymentTransactions,
    recordPayment,
    recordClientLumpSumPayment,
    deletePaymentTransaction,
    syncShipmentPaymentTotals
};
