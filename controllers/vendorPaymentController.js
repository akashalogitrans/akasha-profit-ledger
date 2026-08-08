/* ==========================================================================
   AKASHA LOGITRANS LLP - VENDOR PAYMENT CONTROLLER
   Separate Vendor Payment Ledger & Auto Status Calculation
   ========================================================================== */

const pool = require('../config/db');

function cleanId(param) {
    if (!param) return '';
    return decodeURIComponent(param).replace(/^\//, '');
}

// Helper: Recalculate Vendor Bill payment totals
async function syncVendorPaymentTotals(shipmentId) {
    const [shpRows] = await pool.execute(`SELECT purchase_amount FROM shipments WHERE id = ?`, [shipmentId]);
    if (!shpRows || shpRows.length === 0) return;

    const purAmt = parseFloat(shpRows[0].purchase_amount) || 0;

    const [vpRows] = await pool.execute(
        `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM vendor_payments WHERE shipment_id = ?`,
        [shipmentId]
    );

    const paidAmt = vpRows ? parseFloat(vpRows[0].total_paid) || 0 : 0;
    const cappedPaid = Math.min(purAmt, Math.max(0, paidAmt));
    const balAmt = Math.max(0, purAmt - cappedPaid);
    const status = cappedPaid >= purAmt && purAmt > 0 ? 'PAID' : (cappedPaid > 0 ? 'PARTIAL' : 'UNPAID');

    await pool.execute(
        `UPDATE shipments SET purchase_status = ? WHERE id = ?`,
        [status, shipmentId]
    );

    return { purchase_amount: purAmt, paid_amount: cappedPaid, balance_amount: balAmt, purchase_status: status };
}

// 1. GET ALL VENDOR PAYMENTS REGISTER
async function getVendorPayments(req, res) {
    try {
        const { vendor_id, shipment_id } = req.query;
        let sql = `SELECT * FROM vendor_payments WHERE 1=1`;
        const params = [];

        if (vendor_id) {
            sql += ` AND vendor_id = ?`;
            params.push(vendor_id);
        }

        if (shipment_id) {
            sql += ` AND shipment_id = ?`;
            params.push(cleanId(shipment_id));
        }

        sql += ` ORDER BY payment_date DESC, id DESC`;
        const [rows] = await pool.execute(sql, params);
        return res.json(rows || []);
    } catch (err) {
        console.error('Get Vendor Payments Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 2. RECORD NEW VENDOR PAYMENT
async function recordVendorPayment(req, res) {
    try {
        const { shipment_id, vendor_id, vendor_name, bill_no, payment_date, amount, payment_mode, bank, reference_no, remarks } = req.body;
        const shpId = cleanId(shipment_id);

        if (!shpId) return res.status(400).json({ success: false, message: 'Shipment ID is required.' });

        const pAmt = parseFloat(amount);
        if (isNaN(pAmt) || pAmt <= 0) {
            return res.status(400).json({ success: false, message: 'Payment Amount must be a positive number greater than ₹0.' });
        }

        // Fetch Shipment purchase total and current paid
        const [shpRows] = await pool.execute(`SELECT purchase_amount FROM shipments WHERE id = ?`, [shpId]);
        if (!shpRows || shpRows.length === 0) {
            return res.status(404).json({ success: false, message: `Shipment ${shpId} not found.` });
        }

        const purAmt = parseFloat(shpRows[0].purchase_amount) || 0;
        const [vpRows] = await pool.execute(`SELECT COALESCE(SUM(amount), 0) AS total_paid FROM vendor_payments WHERE shipment_id = ?`, [shpId]);
        const currentPaid = vpRows ? parseFloat(vpRows[0].total_paid) || 0 : 0;
        const remainingBal = Math.max(0, purAmt - currentPaid);

        if (pAmt > (remainingBal + 5.0) && remainingBal > 0) {
            return res.status(400).json({
                success: false,
                message: `Payment amount (₹${pAmt.toLocaleString('en-IN')}) exceeds remaining vendor payable balance (₹${remainingBal.toLocaleString('en-IN')}).`
            });
        }

        const createdBy = req.user ? req.user.name : 'Director';
        const payDate = payment_date || new Date().toISOString().split('T')[0];

        await pool.execute(
            `INSERT INTO vendor_payments (shipment_id, vendor_id, vendor_name, bill_no, payment_date, amount, payment_mode, bank, reference_no, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [shpId, vendor_id || '', vendor_name || 'Vendor', bill_no || '', payDate, pAmt, payment_mode || 'NEFT', bank || 'HDFC Bank', reference_no || '', remarks || '', createdBy]
        );

        const syncResult = await syncVendorPaymentTotals(shpId);

        return res.status(201).json({
            success: true,
            message: `Vendor payment of ₹${pAmt.toLocaleString('en-IN')} recorded successfully against ${shpId}`,
            totals: syncResult
        });
    } catch (err) {
        console.error('Record Vendor Payment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. DELETE VENDOR PAYMENT
async function deleteVendorPayment(req, res) {
    try {
        const vpId = req.params.id;
        const [rows] = await pool.execute(`SELECT shipment_id, amount FROM vendor_payments WHERE id = ?`, [vpId]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Vendor Payment record not found.' });
        }

        const shpId = rows[0].shipment_id;
        await pool.execute(`DELETE FROM vendor_payments WHERE id = ?`, [vpId]);

        const syncResult = await syncVendorPaymentTotals(shpId);

        return res.json({
            success: true,
            message: 'Vendor Payment deleted and balance recalculated successfully.',
            totals: syncResult
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getVendorPayments,
    recordVendorPayment,
    deleteVendorPayment,
    syncVendorPaymentTotals
};
