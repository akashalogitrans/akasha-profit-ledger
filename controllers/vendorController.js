/* ==========================================================================
   AKASHA LOGITRANS LLP - VENDOR MASTER CONTROLLER
   Unified Vendor Ingestion, Deduplication & Linked Shipment Tracking
   ========================================================================== */

const pool = require('../config/db');

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
        // 1. Check if vendor already exists (case-insensitive)
        const [existing] = await pool.execute(
            `SELECT id, name, vendor_type, status FROM vendors WHERE LOWER(TRIM(name)) = ? LIMIT 1`,
            [lowerName]
        );

        if (existing && existing.length > 0) {
            return existing[0];
        }

        // 2. Determine Next Sequential Vendor ID: VND-001, VND-002, etc.
        const [allVnds] = await pool.execute(`SELECT id FROM vendors`);
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

        // 3. Auto-Insert new vendor
        await pool.execute(
            `INSERT INTO vendors (id, name, vendor_type, status, credit_terms, remarks, created_at)
             VALUES (?, ?, ?, 'ACTIVE', '15 Days', 'Auto-created from Shipment Entry', NOW())`,
            [nextId, cleanName, defaultType || 'General Vendor']
        );

        console.log(`✅ [Vendor Master] Auto-created new unique vendor (Excluding Shiplines): ${nextId} - ${cleanName}`);
        return { id: nextId, name: cleanName, vendor_type: defaultType, status: 'ACTIVE' };
    } catch (err) {
        console.error('ensureVendorExists Error:', err.message);
        return null;
    }
}

// Auto-Sync & Deduplicate all vendors from existing shipments (Excludes Shipping Lines)
async function syncAllVendorsFromShipments() {
    try {
        // First, clean up any Shipping Line records from vendors table
        await pool.execute(`DELETE FROM vendors WHERE vendor_type = 'Shipping Line' OR LOWER(TRIM(name)) IN ('maersk', 'maersk line', 'msc', 'hapag', 'hapag lloyd', 'hapag-lloyd', 'cma cgm', 'cosco', 'evergreen', 'one', 'zim')`);

        const [shipments] = await pool.execute(`SELECT id, transport_name, purchase_items FROM shipments`);
        if (!shipments || !Array.isArray(shipments)) return;

        for (const s of shipments) {
            // Check transport_name
            if (s.transport_name && s.transport_name.trim()) {
                await ensureVendorExists(s.transport_name.trim(), 'Transporter');
            }
            // Check purchase_items
            let purItems = [];
            try {
                purItems = typeof s.purchase_items === 'string' ? JSON.parse(s.purchase_items) : s.purchase_items;
            } catch (e) {}

            if (purItems && Array.isArray(purItems)) {
                for (const item of purItems) {
                    if (item && item.vendor_name && item.vendor_name.trim()) {
                        // Skip if it's a shipping line
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

        // Compute linked jobs, totals and balances for every vendor
        const enrichedVendors = (vendors || []).map(v => {
            const vNameLower = (v.name || '').toLowerCase().trim();
            const vIdLower = (v.id || '').toLowerCase().trim();

            const linkedShipments = [];
            let totalPurchase = 0;

            (shipments || []).forEach(s => {
                let isLinked = false;
                let shipmentVendorAmount = 0;
                const expenseDetails = [];

                // Check purchase_items
                let purItems = [];
                try {
                    purItems = typeof s.purchase_items === 'string' ? JSON.parse(s.purchase_items) : s.purchase_items;
                } catch (e) {}

                if (purItems && Array.isArray(purItems)) {
                    purItems.forEach(item => {
                        const itemVendor = (item.vendor_name || '').toLowerCase().trim();
                        if (itemVendor === vNameLower || itemVendor === vIdLower) {
                            isLinked = true;
                            const amt = parseFloat(item.amount || item.foreign_amount || item.taxable) || 0;
                            shipmentVendorAmount += amt;
                            expenseDetails.push(item.expense_name || 'Purchase Charge');
                        }
                    });
                }

                // Check line_name / transport_name
                if (!isLinked) {
                    const lineLower = (s.line_name || '').toLowerCase().trim();
                    const transLower = (s.transport_name || '').toLowerCase().trim();
                    if (lineLower === vNameLower || lineLower === vIdLower) {
                        isLinked = true;
                        shipmentVendorAmount = parseFloat(s.purchase_amount) || 0;
                        expenseDetails.push('Line Freight');
                    } else if (transLower === vNameLower || transLower === vIdLower) {
                        isLinked = true;
                        shipmentVendorAmount = parseFloat(s.purchase_amount) || 0;
                        expenseDetails.push('Transportation');
                    }
                }

                if (isLinked) {
                    totalPurchase += shipmentVendorAmount;
                    linkedShipments.push({
                        shipment_id: s.id,
                        date: s.date,
                        client_company: s.company_name,
                        expense_description: expenseDetails.join(', ') || 'Freight Service',
                        purchase_amount: shipmentVendorAmount,
                        purchase_status: s.purchase_status || 'UNPAID'
                    });
                }
            });

            // Calculate total payments made to this vendor
            let totalPaid = 0;
            (payments || []).forEach(p => {
                const pVId = (p.vendor_id || '').toLowerCase().trim();
                const pVName = (p.vendor_name || '').toLowerCase().trim();
                if (pVId === vIdLower || pVName === vNameLower) {
                    totalPaid += parseFloat(p.amount) || 0;
                }
            });

            const balancePayable = Math.max(0, totalPurchase - totalPaid);

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

            let purItems = [];
            try {
                purItems = typeof s.purchase_items === 'string' ? JSON.parse(s.purchase_items) : s.purchase_items;
            } catch (e) {}

            if (purItems && Array.isArray(purItems)) {
                purItems.forEach(item => {
                    const itemVendor = (item.vendor_name || '').toLowerCase().trim();
                    if (itemVendor === vNameLower || itemVendor === vIdLower) {
                        isLinked = true;
                        const amt = parseFloat(item.amount || item.foreign_amount || item.taxable) || 0;
                        shipmentVendorAmount += amt;
                        expenseDetails.push(item.expense_name || 'Purchase Charge');
                    }
                });
            }

            if (!isLinked) {
                const lineLower = (s.line_name || '').toLowerCase().trim();
                const transLower = (s.transport_name || '').toLowerCase().trim();
                if (lineLower === vNameLower || transLower === vNameLower) {
                    isLinked = true;
                    shipmentVendorAmount = parseFloat(s.purchase_amount) || 0;
                    expenseDetails.push(lineLower === vNameLower ? 'Line Freight' : 'Transportation');
                }
            }

            if (isLinked) {
                totalPurchase += shipmentVendorAmount;
                linkedShipments.push({
                    shipment_id: s.id,
                    date: s.date,
                    client_company: s.company_name,
                    expense_description: expenseDetails.join(', ') || 'Freight Service',
                    purchase_amount: shipmentVendorAmount,
                    purchase_status: s.purchase_status || 'UNPAID'
                });
            }
        });

        let totalPaid = 0;
        (payments || []).forEach(p => {
            totalPaid += parseFloat(p.amount) || 0;
        });

        return res.json({
            success: true,
            vendor: {
                ...v,
                total_jobs: linkedShipments.length,
                total_purchase_amount: totalPurchase,
                total_paid_amount: totalPaid,
                balance_payable: Math.max(0, totalPurchase - totalPaid),
                linked_shipments: linkedShipments,
                payment_history: payments || []
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. CREATE VENDOR (Strict Deduplication check)
async function createVendor(req, res) {
    try {
        const { name, vendor_type, contact_person, mobile, email, gstin, pan, address, bank_details, credit_terms, remarks } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Vendor Company Name is required' });
        }

        const cleanName = name.trim();
        const lowerName = cleanName.toLowerCase();

        // Check duplicate
        const [existing] = await pool.execute(
            `SELECT id, name FROM vendors WHERE LOWER(TRIM(name)) = ?`,
            [lowerName]
        );
        if (existing && existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: `Vendor '${existing[0].name}' already exists with ID ${existing[0].id}. Duplicate entry not allowed.`
            });
        }

        // Determine Next Sequential Vendor ID
        const [allVnds] = await pool.execute(`SELECT id FROM vendors`);
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
        const vendorId = `VND-${String(maxNum + 1).padStart(3, '0')}`;

        await pool.execute(
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

        return res.status(201).json({
            success: true,
            message: `Vendor ${vendorId} (${cleanName}) created successfully`,
            vendor_id: vendorId
        });
    } catch (err) {
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

        // Check if name is taken by another vendor
        const [duplicate] = await pool.execute(
            `SELECT id FROM vendors WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?`,
            [cleanName, id]
        );
        if (duplicate && duplicate.length > 0) {
            return res.status(409).json({ success: false, message: `Another vendor with name '${cleanName}' already exists.` });
        }

        await pool.execute(
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

        return res.json({ success: true, message: `Vendor ${id} updated successfully` });
    } catch (err) {
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
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 6. DELETE VENDOR
async function deleteVendor(req, res) {
    try {
        const id = req.params.id;
        await pool.execute(`UPDATE vendor_payments SET vendor_id = NULL WHERE vendor_id = ?`, [id]);
        await pool.execute(`DELETE FROM vendors WHERE id = ?`, [id]);
        return res.json({ success: true, message: `Vendor ${id} deleted successfully` });
    } catch (err) {
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
