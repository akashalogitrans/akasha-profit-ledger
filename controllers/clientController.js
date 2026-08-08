const pool = require('../config/db');

async function getClients(req, res) {
    try {
        const [rows] = await pool.execute(`SELECT * FROM clients ORDER BY created_at DESC`);
        return res.json(rows || []);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function getClientById(req, res) {
    try {
        const [rows] = await pool.execute(`SELECT * FROM clients WHERE id = ?`, [req.params.id]);
        if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'Client not found' });
        return res.json(rows[0]);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function createClient(req, res) {
    try {
        const { name, contact_person, mobile, email, gstin, pan, address, credit_terms, opening_balance } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Company Name is required' });

        const [rows] = await pool.execute(`SELECT id FROM clients ORDER BY created_at DESC LIMIT 1`);
        let nextNum = 101;
        if (rows && rows.length > 0) {
            const lastId = rows[0].id;
            const num = parseInt(lastId.replace('CLI-', ''));
            if (!isNaN(num)) nextNum = num + 1;
        }

        const clientId = `CLI-${nextNum}`;
        const ownerName = req.user ? req.user.name : 'Director';

        await pool.execute(
            `INSERT INTO clients (id, name, contact_person, mobile, email, gstin, pan, address, credit_terms, opening_balance, status, owner)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
            [clientId, name, contact_person || '', mobile || '', email || '', gstin || '', pan || '', address || '', credit_terms || '30 Days', parseFloat(opening_balance) || 0, ownerName]
        );

        return res.status(201).json({ success: true, message: `Client ${clientId} created successfully`, client_id: clientId });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function updateClient(req, res) {
    try {
        const id = req.params.id;
        const { name, contact_person, mobile, email, gstin, pan, address, credit_terms, opening_balance, status } = req.body;

        await pool.execute(
            `UPDATE clients SET name = ?, contact_person = ?, mobile = ?, email = ?, gstin = ?, pan = ?, address = ?, credit_terms = ?, opening_balance = ?, status = ? WHERE id = ?`,
            [name, contact_person, mobile, email, gstin, pan, address, credit_terms, opening_balance, status, id]
        );

        return res.json({ success: true, message: `Client ${id} updated successfully` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function toggleClientStatus(req, res) {
    try {
        const id = req.params.id;
        const { status } = req.body;
        await pool.execute(`UPDATE clients SET status = ? WHERE id = ?`, [status, id]);
        return res.json({ success: true, message: `Client status updated to ${status}` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function deleteClient(req, res) {
    try {
        const id = req.params.id;
        await pool.execute(`UPDATE shipments SET client_id = NULL WHERE client_id = ?`, [id]);
        await pool.execute(`DELETE FROM clients WHERE id = ?`, [id]);
        return res.json({ success: true, message: `Client ${id} deleted successfully` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getClients,
    getClientById,
    createClient,
    updateClient,
    toggleClientStatus,
    deleteClient
};
