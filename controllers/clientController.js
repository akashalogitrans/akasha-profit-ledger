/* ==========================================================================
   AKASHA LOGITRANS LLP - CLIENT MASTER CONTROLLER
   ========================================================================== */

const pool = require('../config/db');

function cleanId(param) {
    if (!param) return '';
    return decodeURIComponent(param).replace(/^\//, '');
}

async function getClients(req, res) {
    try {
        const [rows] = await pool.execute(`SELECT * FROM clients ORDER BY created_at DESC`);
        return res.json(rows || []);
    } catch (err) {
        try {
            const [rows] = await pool.execute(`SELECT * FROM clients ORDER BY id DESC`);
            return res.json(rows || []);
        } catch (e) {
            console.error('Get Clients Error:', e);
            return res.status(500).json({ success: false, message: e.message });
        }
    }
}

async function createClient(req, res) {
    try {
        const { id, name, owner } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: 'Company Name is required' });
        }

        const [countRows] = await pool.execute(`SELECT COUNT(*) as count FROM clients`);
        const countRow = countRows[0];
        const nextNum = (countRow ? parseInt(countRow.count) : 0) + 101;
        const prefix = name.replace(/[^a-zA-Z0-9]/g, '').trim().substring(0, 3).toUpperCase() || 'CLI';
        const clientId = id || (`${prefix}-${nextNum}`);

        const sql = `INSERT INTO clients (id, name, owner) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE name = VALUES(name), owner = VALUES(owner)`;
        await pool.execute(sql, [clientId, name, owner || 'N/A']);

        return res.json({ success: true, id: clientId, message: 'Client saved successfully in phpMyAdmin' });
    } catch (err) {
        console.error('Create Client Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function updateClient(req, res) {
    try {
        const rawParam = req.params.id || req.params[0];
        const clientId = cleanId(rawParam);
        const { name, owner } = req.body;

        if (!clientId) {
            return res.status(400).json({ success: false, message: 'Client ID is required' });
        }

        const sql = `UPDATE clients SET name = ?, owner = ? WHERE id = ?`;
        await pool.execute(sql, [name, owner, clientId]);

        return res.json({ success: true, message: 'Client updated successfully' });
    } catch (err) {
        console.error('Update Client Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function deleteClient(req, res) {
    try {
        const rawParam = req.params.id || req.params[0];
        const clientId = cleanId(rawParam);

        if (!clientId) {
            return res.status(400).json({ success: false, message: 'Client ID is required' });
        }

        await pool.execute(`DELETE FROM clients WHERE id = ?`, [clientId]);
        return res.json({ success: true, message: 'Client deleted successfully' });
    } catch (err) {
        console.error('Delete Client Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getClients, createClient, updateClient, deleteClient };
