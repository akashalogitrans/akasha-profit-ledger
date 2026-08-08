const pool = require('../config/db');

async function getVendors(req, res) {
    try {
        const [rows] = await pool.execute(`SELECT * FROM vendors ORDER BY created_at DESC`);
        return res.json(rows || []);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function getVendorById(req, res) {
    try {
        const [rows] = await pool.execute(`SELECT * FROM vendors WHERE id = ?`, [req.params.id]);
        if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Vendor not found' });
        return res.json(rows[0]);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function createVendor(req, res) {
    try {
        const { name, vendor_type, contact_person, mobile, email, gstin, pan, address, bank_details, credit_terms, remarks } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Vendor Company Name is required' });

        const [rows] = await pool.execute(`SELECT id FROM vendors ORDER BY created_at DESC LIMIT 1`);
        let nextNum = 1;
        if (rows && rows.length > 0) {
            const lastId = rows[0].id;
            const num = parseInt(lastId.replace('VND-', ''));
            if (!isNaN(num)) nextNum = num + 1;
        }

        const vendorId = `VND-${String(nextNum).padStart(3, '0')}`;

        await pool.execute(
            `INSERT INTO vendors (id, name, vendor_type, contact_person, mobile, email, gstin, pan, address, bank_details, credit_terms, status, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
            [vendorId, name, vendor_type || 'General Vendor', contact_person || '', mobile || '', email || '', gstin || '', pan || '', address || '', bank_details || '', credit_terms || '15 Days', remarks || '']
        );

        return res.status(201).json({ success: true, message: `Vendor ${vendorId} created successfully`, vendor_id: vendorId });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function updateVendor(req, res) {
    try {
        const id = req.params.id;
        const { name, vendor_type, contact_person, mobile, email, gstin, pan, address, bank_details, credit_terms, status, remarks } = req.body;

        await pool.execute(
            `UPDATE vendors SET name = ?, vendor_type = ?, contact_person = ?, mobile = ?, email = ?, gstin = ?, pan = ?, address = ?, bank_details = ?, credit_terms = ?, status = ?, remarks = ? WHERE id = ?`,
            [name, vendor_type, contact_person, mobile, email, gstin, pan, address, bank_details, credit_terms, status, remarks, id]
        );

        return res.json({ success: true, message: `Vendor ${id} updated successfully` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function toggleVendorStatus(req, res) {
    try {
        const id = req.params.id;
        const { status } = req.body;
        await pool.execute(`UPDATE vendors SET status = ? WHERE id = ?`, [status, id]);
        return res.json({ success: true, message: `Vendor status updated to ${status}` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

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
    deleteVendor
};
