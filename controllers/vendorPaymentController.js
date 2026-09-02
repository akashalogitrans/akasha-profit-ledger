/* ==========================================================================
   AKASHA LOGITRANS LLP - VENDOR PAYMENT CONTROLLER
   Vendor-Specific Payment Ledger, Auto Status Calculation & Overpayment Guards
   Hardened with ACID Transactions, Strict Date Normalization & Audit Trail
   ========================================================================== */

const pool = require('../config/db');
const { safeNumber, parseSafeJson, calculatePurchaseLineItem } = require('../utils/financialUtils');
const { normalizeDateOnly } = require('../utils/dateUtils');

function cleanId(param) {
    if (!param) return '';
    return decodeURIComponent(param).replace(/^\//, '').trim();
}

/**
 * Recalculates and updates shipment vendor payment totals and purchase status atomically.
 * @param {Object} conn - MySQL connection (or pool).
 * @param {string} shipmentId - Target shipment ID.
 * @returns {Promise<Object>} Updated purchase payment totals and status.
 */
async function syncVendorPaymentTotals(conn, shipmentId) {
    const db = conn || pool;
    const [shpRows] = await db.execute(`SELECT purchase_amount FROM shipments WHERE id = ?`, [shipmentId]);
    if (!shpRows || shpRows.length === 0) return { purchase_amount: 0, paid_amount: 0, balance_amount: 0, purchase_status: 'UNPAID' };

    const purAmt = safeNumber(shpRows[0].purchase_amount, 0);

    const [vpRows] = await db.execute(
        `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM vendor_payments WHERE shipment_id = ?`,
        [shipmentId]
    );

    const paidAmt = vpRows ? safeNumber(vpRows[0].total_paid, 0) : 0;
    const cappedPaid = Math.min(purAmt, Math.max(0, paidAmt));
    const balAmt = Math.max(0, purAmt - cappedPaid);
    const status = cappedPaid >= purAmt && purAmt > 0 ? 'PAID' : (cappedPaid > 0 ? 'PARTIAL' : 'UNPAID');

    await db.execute(
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
            sql += ` AND (vendor_id = ? OR LOWER(TRIM(vendor_name)) = LOWER(TRIM(?)))`;
            params.push(vendor_id, vendor_id);
        }

        if (shipment_id) {
            sql += ` AND shipment_id = ?`;
            params.push(cleanId(shipment_id));
        }

        sql += ` ORDER BY payment_date DESC, id DESC`;
        const [rows] = await pool.execute(sql, params);

        const sanitized = (rows || []).map(r => ({
            ...r,
            payment_date: normalizeDateOnly(r.payment_date),
            amount: safeNumber(r.amount, 0)
        }));

        return res.json(sanitized);
    } catch (err) {
        console.error('Get Vendor Payments Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 2. RECORD NEW VENDOR PAYMENT (Atomic Transaction with Concurrency & Vendor-Level Overpayment Guard)
async function recordVendorPayment(req, res) {
    try {
        const { shipment_id, vendor_id, vendor_name, bill_no, payment_date, amount, payment_mode, bank, reference_no, remarks } = req.body;
        const shpId = cleanId(shipment_id);

        if (!shpId) return res.status(400).json({ success: false, message: 'Shipment ID is required.' });

        const pAmt = safeNumber(amount, -1);
        if (pAmt <= 0) {
            return res.status(400).json({ success: false, message: 'Payment Amount must be a valid positive number greater than ₹0.00.' });
        }

        if (!payment_date) {
            return res.status(400).json({ success: false, message: 'Payment Date is required.' });
        }

        // Validate & Resolve Vendor Identity
        let resolvedVendorId = vendor_id ? String(vendor_id).trim() : '';
        let resolvedVendorName = vendor_name ? String(vendor_name).trim() : '';

        if (!resolvedVendorId && !resolvedVendorName) {
            return res.status(400).json({ success: false, message: 'Vendor ID or Vendor Name is required.' });
        }

        // Fetch Vendor details from Master
        const [vMasterRows] = await pool.execute(
            `SELECT id, name FROM vendors WHERE id = ? OR LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`,
            [resolvedVendorId || '__NONE__', resolvedVendorName || resolvedVendorId]
        );

        if (vMasterRows && vMasterRows.length > 0) {
            resolvedVendorId = vMasterRows[0].id;
            resolvedVendorName = vMasterRows[0].name;
        } else if (!resolvedVendorName) {
            resolvedVendorName = resolvedVendorId;
        }

        const payDate = normalizeDateOnly(payment_date);
        const createdBy = req.user ? req.user.name : 'Director';

        let syncResult = null;
        await pool.transaction(async (conn) => {
            // Lock shipment row for update to prevent concurrent double payment
            const [shpRows] = await conn.execute(
                `SELECT id, purchase_amount, purchase_items, transport_name, line_name FROM shipments WHERE id = ? FOR UPDATE`,
                [shpId]
            );

            if (!shpRows || shpRows.length === 0) {
                const err = new Error(`Shipment ${shpId} not found.`);
                err.statusCode = 404;
                throw err;
            }

            const totalShipmentPurAmt = safeNumber(shpRows[0].purchase_amount, 0);

            // Calculate vendor-specific purchase cost allocated to THIS vendor in this shipment
            const rawPurItems = parseSafeJson(shpRows[0].purchase_items, []);
            const targetVndName = resolvedVendorName.toLowerCase().trim();
            const targetVndId = resolvedVendorId.toLowerCase().trim();

            let vendorAllocatedCost = 0;
            let matchedItemCount = 0;

            if (Array.isArray(rawPurItems) && rawPurItems.length > 0) {
                rawPurItems.forEach(rawIt => {
                    const it = calculatePurchaseLineItem(rawIt);
                    const itemVnd = (it.vendor_name || '').toLowerCase().trim();
                    if (itemVnd === targetVndName || itemVnd === targetVndId) {
                        vendorAllocatedCost += it.amount;
                        matchedItemCount++;
                    }
                });
            }

            // Fallback ONLY if no purchase items matched
            if (matchedItemCount === 0) {
                const transLower = (shpRows[0].transport_name || '').toLowerCase().trim();
                const lineLower = (shpRows[0].line_name || '').toLowerCase().trim();
                if (transLower === targetVndName || transLower === targetVndId || lineLower === targetVndName || lineLower === targetVndId) {
                    vendorAllocatedCost = totalShipmentPurAmt;
                } else {
                    vendorAllocatedCost = totalShipmentPurAmt; // Generic single vendor fallback
                }
            }

            // Calculate total payments already made to THIS specific vendor on THIS shipment
            const [vPayRows] = await conn.execute(
                `SELECT COALESCE(SUM(amount), 0) AS vendor_paid FROM vendor_payments WHERE shipment_id = ? AND (vendor_id = ? OR LOWER(TRIM(vendor_name)) = LOWER(TRIM(?))) FOR UPDATE`,
                [shpId, resolvedVendorId, resolvedVendorName]
            );
            const currentVendorPaid = vPayRows ? safeNumber(vPayRows[0].vendor_paid, 0) : 0;
            const vendorRemainingBal = Math.max(0, vendorAllocatedCost - currentVendorPaid);

            // Strict Vendor Overpayment Enforcement
            if (vendorRemainingBal <= 0 && vendorAllocatedCost > 0) {
                const err = new Error(`Vendor '${resolvedVendorName}' is already fully paid on shipment ${shpId} (Payable Balance is ₹0.00). Overpayment is not permitted.`);
                err.statusCode = 400;
                throw err;
            }

            if (pAmt > vendorRemainingBal && vendorAllocatedCost > 0) {
                const err = new Error(`Payment amount (₹${pAmt.toLocaleString('en-IN')}) exceeds remaining payable balance (₹${vendorRemainingBal.toLocaleString('en-IN')}) for vendor '${resolvedVendorName}'.`);
                err.statusCode = 400;
                throw err;
            }

            // Insert vendor payment record
            const [insertRes] = await conn.execute(
                `INSERT INTO vendor_payments (shipment_id, vendor_id, vendor_name, bill_no, payment_date, amount, payment_mode, bank, reference_no, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [shpId, resolvedVendorId, resolvedVendorName, bill_no || '', payDate, pAmt, payment_mode || 'NEFT', bank || 'HDFC Bank', reference_no || '', remarks || '', createdBy]
            );

            // Audit log
            await conn.execute(
                `INSERT INTO audit_logs (user_name, action, target_type, target_id, details) VALUES (?, 'RECORD_VENDOR_PAYMENT', 'VENDOR_PAYMENT', ?, ?)`,
                [createdBy, String(insertRes.insertId), `Recorded payment of ₹${pAmt} to ${resolvedVendorName} for shipment ${shpId}`]
            );

            // Recalculate shipment purchase status atomically
            syncResult = await syncVendorPaymentTotals(conn, shpId);
        });

        return res.status(201).json({
            success: true,
            message: `Vendor payment of ₹${pAmt.toLocaleString('en-IN')} recorded successfully against ${shpId}`,
            totals: syncResult
        });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        console.error('Record Vendor Payment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. UPDATE / EDIT VENDOR PAYMENT (Atomic Transaction with Validation)
async function updateVendorPayment(req, res) {
    try {
        const vpId = req.params.id;
        const { payment_date, amount, payment_mode, bank, reference_no, remarks, bill_no } = req.body;

        const pAmt = safeNumber(amount, -1);
        if (pAmt <= 0) {
            return res.status(400).json({ success: false, message: 'Payment Amount must be a valid positive number greater than ₹0.00.' });
        }

        const payDate = normalizeDateOnly(payment_date);
        const userName = req.user ? req.user.name : 'Director';

        let syncResult = null;
        await pool.transaction(async (conn) => {
            const [vpRows] = await conn.execute(`SELECT * FROM vendor_payments WHERE id = ? FOR UPDATE`, [vpId]);
            if (!vpRows || vpRows.length === 0) {
                const err = new Error(`Vendor payment record ${vpId} not found.`);
                err.statusCode = 404;
                throw err;
            }

            const oldPayment = vpRows[0];
            const shpId = oldPayment.shipment_id;
            const vId = oldPayment.vendor_id;
            const vName = oldPayment.vendor_name;

            // Fetch shipment purchase cost for this vendor
            const [shpRows] = await conn.execute(`SELECT purchase_amount, purchase_items, transport_name, line_name FROM shipments WHERE id = ? FOR UPDATE`, [shpId]);
            if (!shpRows || shpRows.length === 0) {
                const err = new Error(`Shipment ${shpId} not found.`);
                err.statusCode = 404;
                throw err;
            }

            const totalShipmentPurAmt = safeNumber(shpRows[0].purchase_amount, 0);
            const rawPurItems = parseSafeJson(shpRows[0].purchase_items, []);
            let vendorAllocatedCost = 0;
            let matched = 0;

            if (Array.isArray(rawPurItems) && rawPurItems.length > 0) {
                rawPurItems.forEach(rawIt => {
                    const it = calculatePurchaseLineItem(rawIt);
                    const itemVnd = (it.vendor_name || '').toLowerCase().trim();
                    if ((vName && itemVnd === vName.toLowerCase().trim()) || (vId && itemVnd === vId.toLowerCase().trim())) {
                        vendorAllocatedCost += it.amount;
                        matched++;
                    }
                });
            }

            if (matched === 0) {
                vendorAllocatedCost = totalShipmentPurAmt;
            }

            // Total paid to this vendor excluding this current payment record
            const [otherPayRows] = await conn.execute(
                `SELECT COALESCE(SUM(amount), 0) AS total_other_paid FROM vendor_payments WHERE shipment_id = ? AND id != ? AND (vendor_id = ? OR LOWER(TRIM(vendor_name)) = LOWER(TRIM(?)))`,
                [shpId, vpId, vId || '', vName || '']
            );
            const otherPaid = otherPayRows ? safeNumber(otherPayRows[0].total_other_paid, 0) : 0;
            const vendorRemainingBal = Math.max(0, vendorAllocatedCost - otherPaid);

            if (pAmt > vendorRemainingBal && vendorAllocatedCost > 0) {
                const err = new Error(`Updated payment amount (₹${pAmt.toLocaleString('en-IN')}) exceeds remaining vendor payable balance (₹${vendorRemainingBal.toLocaleString('en-IN')}).`);
                err.statusCode = 400;
                throw err;
            }

            // Update payment record
            await conn.execute(
                `UPDATE vendor_payments SET payment_date = ?, amount = ?, payment_mode = ?, bank = ?, reference_no = ?, remarks = ?, bill_no = ? WHERE id = ?`,
                [payDate, pAmt, payment_mode || oldPayment.payment_mode, bank || oldPayment.bank, reference_no !== undefined ? reference_no : oldPayment.reference_no, remarks !== undefined ? remarks : oldPayment.remarks, bill_no !== undefined ? bill_no : oldPayment.bill_no, vpId]
            );

            // Audit log
            await conn.execute(
                `INSERT INTO audit_logs (user_name, action, target_type, target_id, details) VALUES (?, 'UPDATE_VENDOR_PAYMENT', 'VENDOR_PAYMENT', ?, ?)`,
                [userName, String(vpId), `Updated payment ${vpId} for shipment ${shpId}: Old Amount ₹${oldPayment.amount} -> New Amount ₹${pAmt}`]
            );

            syncResult = await syncVendorPaymentTotals(conn, shpId);
        });

        return res.json({
            success: true,
            message: `Vendor payment ${vpId} updated successfully.`,
            totals: syncResult
        });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        console.error('Update Vendor Payment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. DELETE VENDOR PAYMENT (Atomic Transaction & Audit Trail)
async function deleteVendorPayment(req, res) {
    try {
        const vpId = req.params.id;
        const userName = req.user ? req.user.name : 'Director';

        let syncResult = null;
        await pool.transaction(async (conn) => {
            const [rows] = await conn.execute(`SELECT shipment_id, amount, vendor_name FROM vendor_payments WHERE id = ? FOR UPDATE`, [vpId]);
            if (!rows || rows.length === 0) {
                const err = new Error('Vendor Payment record not found.');
                err.statusCode = 404;
                throw err;
            }

            const shpId = rows[0].shipment_id;
            const oldAmount = rows[0].amount;
            const vName = rows[0].vendor_name;

            await conn.execute(`DELETE FROM vendor_payments WHERE id = ?`, [vpId]);

            // Audit log
            await conn.execute(
                `INSERT INTO audit_logs (user_name, action, target_type, target_id, details) VALUES (?, 'DELETE_VENDOR_PAYMENT', 'VENDOR_PAYMENT', ?, ?)`,
                [userName, String(vpId), `Deleted vendor payment ${vpId} (Amount: ₹${oldAmount}, Vendor: ${vName}, Shipment: ${shpId})`]
            );

            syncResult = await syncVendorPaymentTotals(conn, shpId);
        });

        return res.json({
            success: true,
            message: 'Vendor Payment deleted and balance recalculated successfully.',
            totals: syncResult
        });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        console.error('Delete Vendor Payment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getVendorPayments,
    recordVendorPayment,
    updateVendorPayment,
    deleteVendorPayment,
    syncVendorPaymentTotals
};
