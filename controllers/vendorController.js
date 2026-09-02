/* ==========================================================================
   AKASHA LOGITRANS LLP - VENDOR MASTER CONTROLLER
   Unified Vendor Ingestion, Deduplication & Linked Shipment Tracking
   Hardened with Central Financial Engine, Concurrency Safety & Audit Logs
   ========================================================================== */

const pool = require('../config/db');
const { safeNumber, parseSafeJson, calculatePurchaseLineItem } = require('../utils/financialUtils');
const { normalizeDateOnly } = require('../utils/dateUtils');

const KNOWN_SHIPPING_LINES = [
    'maersk', 'maersk line', 'msc', 'hapag', 'hapag lloyd', 'hapag-lloyd',
    'one', 'ocean network express', 'cma cgm', 'cmacgm', 'cosco', 'evergreen',
    'yang ming', 'zim', 'wan hai', 'hyundai', 'hmm', 'oocl', 'safmarine',
    'emirates shipping line', 'kmtc', 'samudera', 'ts lines', 'blpl', 'sarjak'
];

function isShippingLine(name, type) {
    if (!name) return false;
    const n = name.trim().toLowerCase();
    const t = (type || '').trim().toLowerCase();
    if (t === 'shipping line' || t === 'line') return true;
    return KNOWN_SHIPPING_LINES.some(line => n === line || n.startsWith(line + ' ') || n.endsWith(' ' + line));
}

// Helper: Ensure a vendor exists in Vendor Master without creating duplicates (Excludes Shipping Lines)
async function ensureVendorExists(vendorName, defaultType = 'General Vendor') {
    if (!vendorName || typeof vendorName !== 'string' || !vendorName.trim()) {
        return null;
    }

    const cleanName = vendorName.trim();
    const lowerName = cleanName.toLowerCase();

    // STRICT: Do not add Shipping Lines to Vendor Master!
    if (isShippingLine(cleanName, defaultType)) {
        return null;
    }

    try {
        let createdVendor = null;
        await pool.transaction(async (conn) => {
            // 1. Check if vendor already exists (case-insensitive)
            const [existing] = await conn.execute(
                `SELECT id, name, vendor_type, status FROM vendors WHERE LOWER(TRIM(name)) = ? LIMIT 1`,
                [lowerName]
            );

            if (existing && existing.length > 0) {
                createdVendor = existing[0];
                return;
            }

            // 2. Determine Next Sequential Vendor ID with locking: VND-001, VND-002, etc.
            const [allVnds] = await conn.execute(`SELECT id FROM vendors FOR UPDATE`);
            let maxNum = 0;
            if (allVnds && Array.isArray(allVnds)) {
                allVnds.forEach(v => {
                    const match = String(v.id).match(/VND-(\d+)/i);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > maxNum) maxNum = num;
                    }
                });
            }
            const nextId = `VND-${String(maxNum + 1).padStart(3, '0')}`;

            // 3. Insert new vendor with collision catch
            try {
                await conn.execute(
                    `INSERT INTO vendors (id, name, vendor_type, status, credit_terms, remarks, created_at)
                     VALUES (?, ?, ?, 'ACTIVE', '15 Days', 'Auto-created from Shipment Entry', NOW())`,
                    [nextId, cleanName, defaultType || 'General Vendor']
                );
                createdVendor = { id: nextId, name: cleanName, vendor_type: defaultType, status: 'ACTIVE' };
            } catch (insErr) {
                // Handle concurrent insert collision cleanly
                const [retryExisting] = await conn.execute(
                    `SELECT id, name, vendor_type, status FROM vendors WHERE LOWER(TRIM(name)) = ? LIMIT 1`,
                    [lowerName]
                );
                if (retryExisting && retryExisting.length > 0) {
                    createdVendor = retryExisting[0];
                } else {
                    throw insErr;
                }
            }
        });
        return createdVendor;
    } catch (err) {
        console.error('ensureVendorExists Error:', err.message);
        return null;
    }
}

// Auto-Sync & Deduplicate all vendors from existing shipments (Excludes Shipping Lines)
async function syncAllVendorsFromShipments() {
    try {
        await pool.execute(`DELETE FROM vendors WHERE vendor_type = 'Shipping Line' OR LOWER(TRIM(name)) IN ('maersk', 'maersk line', 'msc', 'hapag', 'hapag lloyd', 'hapag-lloyd', 'cma cgm', 'cosco', 'evergreen', 'one', 'zim')`);

        const [shipments] = await pool.execute(`SELECT id, transport_name, purchase_items FROM shipments`);
        if (!shipments || !Array.isArray(shipments)) return;

        for (const s of shipments) {
            if (s.transport_name && s.transport_name.trim()) {
                await ensureVendorExists(s.transport_name.trim(), 'Transporter');
            }
            const purItems = parseSafeJson(s.purchase_items, []);
            if (Array.isArray(purItems)) {
                for (const item of purItems) {
                    if (item && item.vendor_name && item.vendor_name.trim()) {
                        if (!isShippingLine(item.vendor_name, item.expense_name)) {
                            await ensureVendorExists(item.vendor_name.trim(), item.expense_name || 'General Vendor');
                        }
                    }
                }
            }
        }
        console.log('✅ [Vendor Master] Complete Vendor Sync Done (Shipping Lines Filtered Out)');
    } catch (err) {
        console.error('syncAllVendorsFromShipments Error:', err.message);
    }
}

// 1. GET ALL VENDORS (With Linked Shipments, Total Purchases, Total Paid & Balances)
async function getVendors(req, res) {
    try {
        const [vendors] = await pool.execute(`SELECT * FROM vendors ORDER BY id ASC`);
        const [shipments] = await pool.execute(`SELECT id, date, client_id, company_name, line_name, transport_name, purchase_amount, purchase_status, purchase_items FROM shipments`);
        const [payments] = await pool.execute(`SELECT vendor_id, vendor_name, shipment_id, amount FROM vendor_payments`);

        const enrichedVendors = (vendors || []).map(v => {
            const vNameLower = (v.name || '').toLowerCase().trim();
            const vIdLower = (v.id || '').toLowerCase().trim();

            const linkedShipments = [];
            let totalPurchase = 0;

            (shipments || []).forEach(s => {
                let isLinked = false;
                let shipmentVendorAmount = 0;
                const expenseDetails = [];

                const purItems = parseSafeJson(s.purchase_items, []);
                if (Array.isArray(purItems) && purItems.length > 0) {
                    purItems.forEach(rawItem => {
                        const item = calculatePurchaseLineItem(rawItem);
                        const itemVendor = (item.vendor_name || '').toLowerCase().trim();
                        if (itemVendor === vNameLower || itemVendor === vIdLower) {
                            isLinked = true;
                            shipmentVendorAmount += item.amount;
                            expenseDetails.push(item.expense_name || 'Purchase Charge');
                        }
                    });
                }

                // Fallback check ONLY if no purchase_items existed at all
                if (!isLinked && (!purItems || purItems.length === 0)) {
                    const transLower = (s.transport_name || '').toLowerCase().trim();
                    if (transLower === vNameLower || transLower === vIdLower) {
                        isLinked = true;
                        shipmentVendorAmount = safeNumber(s.purchase_amount, 0);
                        expenseDetails.push('Transportation');
                    }
                }

                if (isLinked && shipmentVendorAmount > 0) {
                    totalPurchase += shipmentVendorAmount;

                    // Calculate payments made to THIS vendor for THIS specific shipment
                    let vendorJobPaid = 0;
                    (payments || []).forEach(p => {
                        const pShp = String(p.shipment_id || '').trim();
                        const pVId = (p.vendor_id || '').toLowerCase().trim();
                        const pVName = (p.vendor_name || '').toLowerCase().trim();
                        if (pShp === String(s.id).trim() && (pVId === vIdLower || pVName === vNameLower)) {
                            vendorJobPaid += safeNumber(p.amount, 0);
                        }
                    });
                    vendorJobPaid = Math.round(vendorJobPaid * 100) / 100;
                    const vendorJobBal = Math.max(0, Math.round((shipmentVendorAmount - vendorJobPaid) * 100) / 100);
                    const vendorJobStatus = (vendorJobPaid >= shipmentVendorAmount && shipmentVendorAmount > 0) ? 'PAID' : (vendorJobPaid > 0 ? 'PARTIAL' : 'UNPAID');

                    linkedShipments.push({
                        shipment_id: s.id,
                        date: normalizeDateOnly(s.date),
                        client_company: s.company_name,
                        expense_description: expenseDetails.join(', ') || 'Freight Service',
                        purchase_amount: Math.round(shipmentVendorAmount * 100) / 100,
                        paid_amount: vendorJobPaid,
                        balance_amount: vendorJobBal,
                        purchase_status: vendorJobStatus,
                        shipment_overall_status: s.purchase_status || 'UNPAID'
                    });
                }
            });

            // Calculate total payments made to this vendor
            let totalPaid = 0;
            (payments || []).forEach(p => {
                const pVId = (p.vendor_id || '').toLowerCase().trim();
                const pVName = (p.vendor_name || '').toLowerCase().trim();
                if (pVId === vIdLower || pVName === vNameLower) {
                    totalPaid += safeNumber(p.amount, 0);
                }
            });

            totalPurchase = Math.round(totalPurchase * 100) / 100;
            totalPaid = Math.round(totalPaid * 100) / 100;
            const balancePayable = Math.max(0, Math.round((totalPurchase - totalPaid) * 100) / 100);

            return {
                ...v,
                total_jobs: linkedShipments.length,
                total_purchase_amount: totalPurchase,
                total_paid_amount: totalPaid,
                balance_payable: balancePayable,
                linked_shipments: linkedShipments
            };
        });

        return res.json(enrichedVendors);
    } catch (err) {
        console.error('getVendors Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 2. GET SINGLE VENDOR BY ID
async function getVendorById(req, res) {
    try {
        const vendorId = req.params.id;
        const [rows] = await pool.execute(`SELECT * FROM vendors WHERE id = ?`, [vendorId]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        const v = rows[0];
        const vNameLower = (v.name || '').toLowerCase().trim();
        const vIdLower = (v.id || '').toLowerCase().trim();

        const [shipments] = await pool.execute(`SELECT id, date, client_id, company_name, line_name, transport_name, purchase_amount, purchase_status, purchase_items FROM shipments`);
        const [payments] = await pool.execute(`SELECT * FROM vendor_payments WHERE vendor_id = ? OR LOWER(TRIM(vendor_name)) = ?`, [vendorId, vNameLower]);

        const linkedShipments = [];
        let totalPurchase = 0;

        (shipments || []).forEach(s => {
            let isLinked = false;
            let shipmentVendorAmount = 0;
            const expenseDetails = [];

            const purItems = parseSafeJson(s.purchase_items, []);
            if (Array.isArray(purItems) && purItems.length > 0) {
                purItems.forEach(rawItem => {
                    const item = calculatePurchaseLineItem(rawItem);
                    const itemVendor = (item.vendor_name || '').toLowerCase().trim();
                    if (itemVendor === vNameLower || itemVendor === vIdLower) {
                        isLinked = true;
                        shipmentVendorAmount += item.amount;
                        expenseDetails.push(item.expense_name || 'Purchase Charge');
                    }
                });
            }

            if (!isLinked && (!purItems || purItems.length === 0)) {
                const transLower = (s.transport_name || '').toLowerCase().trim();
                if (transLower === vNameLower || transLower === vIdLower) {
                    isLinked = true;
                    shipmentVendorAmount = safeNumber(s.purchase_amount, 0);
                    expenseDetails.push('Transportation');
                }
            }

            if (isLinked && shipmentVendorAmount > 0) {
                totalPurchase += shipmentVendorAmount;

                // Calculate payments made to THIS vendor for THIS specific shipment
                let vendorJobPaid = 0;
                (payments || []).forEach(p => {
                    const pShp = String(p.shipment_id || '').trim();
                    const pVId = (p.vendor_id || '').toLowerCase().trim();
                    const pVName = (p.vendor_name || '').toLowerCase().trim();
                    if (pShp === String(s.id).trim() && (pVId === vIdLower || pVName === vNameLower)) {
                        vendorJobPaid += safeNumber(p.amount, 0);
                    }
                });
                vendorJobPaid = Math.round(vendorJobPaid * 100) / 100;
                const vendorJobBal = Math.max(0, Math.round((shipmentVendorAmount - vendorJobPaid) * 100) / 100);
                const vendorJobStatus = (vendorJobPaid >= shipmentVendorAmount && shipmentVendorAmount > 0) ? 'PAID' : (vendorJobPaid > 0 ? 'PARTIAL' : 'UNPAID');

                linkedShipments.push({
                    shipment_id: s.id,
                    date: normalizeDateOnly(s.date),
                    client_company: s.company_name,
                    expense_description: expenseDetails.join(', ') || 'Freight Service',
                    purchase_amount: Math.round(shipmentVendorAmount * 100) / 100,
                    paid_amount: vendorJobPaid,
                    balance_amount: vendorJobBal,
                    purchase_status: vendorJobStatus,
                    shipment_overall_status: s.purchase_status || 'UNPAID'
                });
            }
        });

        let totalPaid = 0;
        (payments || []).forEach(p => {
            totalPaid += safeNumber(p.amount, 0);
        });

        totalPurchase = Math.round(totalPurchase * 100) / 100;
        totalPaid = Math.round(totalPaid * 100) / 100;

        return res.json({
            success: true,
            vendor: {
                ...v,
                total_jobs: linkedShipments.length,
                total_purchase_amount: totalPurchase,
                total_paid_amount: totalPaid,
                balance_payable: Math.max(0, Math.round((totalPurchase - totalPaid) * 100) / 100),
                linked_shipments: linkedShipments,
                payment_history: payments || []
            }
        });
    } catch (err) {
        console.error('getVendorById Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. CREATE VENDOR (Strict Deduplication check & Concurrency-Safe ID)
async function createVendor(req, res) {
    try {
        const { name, vendor_type, contact_person, mobile, email, gstin, pan, address, bank_details, credit_terms, remarks } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Vendor Company Name is required' });
        }

        const cleanName = name.trim();
        const lowerName = cleanName.toLowerCase();

        let vendorId = null;
        await pool.transaction(async (conn) => {
            // Check duplicate
            const [existing] = await conn.execute(
                `SELECT id, name FROM vendors WHERE LOWER(TRIM(name)) = ?`,
                [lowerName]
            );
            if (existing && existing.length > 0) {
                const err = new Error(`Vendor '${existing[0].name}' already exists with ID ${existing[0].id}. Duplicate entry not allowed.`);
                err.statusCode = 409;
                throw err;
            }

            // Determine Next Sequential Vendor ID with table lock
            const [allVnds] = await conn.execute(`SELECT id FROM vendors FOR UPDATE`);
            let maxNum = 0;
            if (allVnds && Array.isArray(allVnds)) {
                allVnds.forEach(v => {
                    const match = String(v.id).match(/VND-(\d+)/i);
                    if (match) {
                        const num = parseInt(match[1], 10);
                        if (num > maxNum) maxNum = num;
                    }
                });
            }
            vendorId = `VND-${String(maxNum + 1).padStart(3, '0')}`;

            await conn.execute(
                `INSERT INTO vendors (id, name, vendor_type, contact_person, mobile, email, gstin, pan, address, bank_details, credit_terms, status, remarks, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, NOW())`,
                [
                    vendorId, cleanName, vendor_type || 'General Vendor',
                    contact_person ? contact_person.trim() : '',
                    mobile ? mobile.trim() : '',
                    email ? email.trim() : '',
                    gstin ? gstin.trim().toUpperCase() : '',
                    pan ? pan.trim().toUpperCase() : '',
                    address ? address.trim() : '',
                    bank_details ? bank_details.trim() : '',
                    credit_terms ? credit_terms.trim() : '15 Days',
                    remarks ? remarks.trim() : ''
                ]
            );

            // Audit log
            const userName = req.user ? req.user.name : 'Director';
            await conn.execute(
                `INSERT INTO audit_logs (user_name, action, target_type, target_id, details) VALUES (?, 'CREATE_VENDOR', 'VENDOR', ?, ?)`,
                [userName, vendorId, `Created vendor ${vendorId} - ${cleanName}`]
            );
        });

        return res.status(201).json({
            success: true,
            message: `Vendor ${vendorId} (${cleanName}) created successfully`,
            vendor_id: vendorId
        });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        console.error('createVendor Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. UPDATE VENDOR
async function updateVendor(req, res) {
    try {
        const id = req.params.id;
        const { name, vendor_type, contact_person, mobile, email, gstin, pan, address, bank_details, credit_terms, status, remarks } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Vendor Name is required' });
        }

        const cleanName = name.trim();

        await pool.transaction(async (conn) => {
            // Check if name is taken by another vendor
            const [duplicate] = await conn.execute(
                `SELECT id FROM vendors WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?`,
                [cleanName, id]
            );
            if (duplicate && duplicate.length > 0) {
                const err = new Error(`Another vendor with name '${cleanName}' already exists.`);
                err.statusCode = 409;
                throw err;
            }

            await conn.execute(
                `UPDATE vendors SET name = ?, vendor_type = ?, contact_person = ?, mobile = ?, email = ?, gstin = ?, pan = ?, address = ?, bank_details = ?, credit_terms = ?, status = ?, remarks = ? WHERE id = ?`,
                [
                    cleanName, vendor_type || 'General Vendor',
                    contact_person || '', mobile || '', email || '',
                    gstin ? gstin.toUpperCase() : '',
                    pan ? pan.toUpperCase() : '',
                    address || '', bank_details || '',
                    credit_terms || '15 Days', status || 'ACTIVE', remarks || '', id
                ]
            );

            const userName = req.user ? req.user.name : 'Director';
            await conn.execute(
                `INSERT INTO audit_logs (user_name, action, target_type, target_id, details) VALUES (?, 'UPDATE_VENDOR', 'VENDOR', ?, ?)`,
                [userName, id, `Updated vendor ${id} (${cleanName})`]
            );
        });

        return res.json({ success: true, message: `Vendor ${id} updated successfully` });
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        console.error('updateVendor Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 5. TOGGLE VENDOR STATUS
async function toggleVendorStatus(req, res) {
    try {
        const id = req.params.id;
        const { status } = req.body;
        await pool.execute(`UPDATE vendors SET status = ? WHERE id = ?`, [status || 'ACTIVE', id]);
        return res.json({ success: true, message: `Vendor status updated to ${status}` });
    } catch (err) {
        console.error('toggleVendorStatus Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 6. DELETE / DEACTIVATE VENDOR (Financial History Protection Policy)
async function deleteVendor(req, res) {
    try {
        const id = req.params.id;

        // Check if vendor has linked payments
        const [payRows] = await pool.execute(`SELECT COUNT(*) as count FROM vendor_payments WHERE vendor_id = ?`, [id]);
        const payCount = payRows && payRows[0] ? payRows[0].count : 0;

        // Check if vendor has linked shipments
        const [shpRows] = await pool.execute(`SELECT id, transport_name, purchase_items FROM shipments`);
        let linkedJobCount = 0;
        const [vRow] = await pool.execute(`SELECT name FROM vendors WHERE id = ?`, [id]);
        const vName = vRow && vRow[0] ? vRow[0].name.toLowerCase().trim() : '';

        (shpRows || []).forEach(s => {
            const transLower = (s.transport_name || '').toLowerCase().trim();
            if (transLower === vName) linkedJobCount++;
            const pItems = parseSafeJson(s.purchase_items, []);
            if (Array.isArray(pItems)) {
                pItems.forEach(it => {
                    const itVnd = (it.vendor_name || '').toLowerCase().trim();
                    if (itVnd === vName || itVnd === id.toLowerCase().trim()) linkedJobCount++;
                });
            }
        });

        const userName = req.user ? req.user.name : 'Director';

        // Strict Policy: If financial history exists, deactivate rather than deleting
        if (payCount > 0 || linkedJobCount > 0) {
            await pool.execute(`UPDATE vendors SET status = 'INACTIVE' WHERE id = ?`, [id]);
            await pool.execute(
                `INSERT INTO audit_logs (user_name, action, target_type, target_id, details) VALUES (?, 'DEACTIVATE_VENDOR', 'VENDOR', ?, ?)`,
                [userName, id, `Vendor ${id} has ${payCount} payments & ${linkedJobCount} linked jobs. Deactivated to preserve financial history.`]
            );
            return res.json({
                success: true,
                message: `Vendor ${id} has ${payCount} payments and ${linkedJobCount} linked job allocations. It was deactivated (set to INACTIVE) to preserve accounting history.`,
                status: 'INACTIVE',
                action_taken: 'DEACTIVATED'
            });
        }

        // If no financial transactions exist, hard delete is safe
        await pool.execute(`DELETE FROM vendors WHERE id = ?`, [id]);
        await pool.execute(
            `INSERT INTO audit_logs (user_name, action, target_type, target_id, details) VALUES (?, 'DELETE_VENDOR', 'VENDOR', ?, ?)`,
            [userName, id, `Vendor ${id} deleted (zero financial history).`]
        );
        return res.json({ success: true, message: `Vendor ${id} deleted successfully.`, action_taken: 'DELETED' });
    } catch (err) {
        console.error('deleteVendor Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getVendors,
    getVendorById,
    createVendor,
    updateVendor,
    toggleVendorStatus,
    deleteVendor,
    ensureVendorExists,
    syncAllVendorsFromShipments
};
