/* ==========================================================================
   AKASHA LOGITRANS LLP - CLIENT MASTER CONTROLLER
   Enterprise Client Management, Financial Summary Metrics, & Clean REST APIs
   ========================================================================== */

const pool = require('../config/db');

function cleanId(param) {
    if (!param) return '';
    return decodeURIComponent(param).replace(/^\//, '');
}

// 1. GET ALL CLIENTS (With Real-Time Financial Summary Metrics, Search & Pagination)
async function getClients(req, res) {
    try {
        const { search, page = 1, limit = 100 } = req.query;
        const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

        let sql = `
            SELECT 
                c.id,
                c.name,
                c.owner,
                c.created_at,
                COUNT(s.id) AS shipment_count,
                COALESCE(SUM(s.sale_amount), 0) AS total_revenue,
                COALESCE(SUM(
                    GREATEST(0, s.sale_amount - LEAST(s.sale_amount, COALESCE(s.received_amount, 0)))
                ), 0) AS outstanding_balance,
                MAX(s.date) AS last_shipment_date
            FROM clients c
            LEFT JOIN shipments s ON c.id = s.client_id
            WHERE 1=1
        `;
        
        const params = [];

        if (search) {
            sql += ` AND (c.id LIKE ? OR c.name LIKE ? OR c.owner LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q);
        }

        sql += ` GROUP BY c.id, c.name, c.owner, c.created_at ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.execute(sql, params);
        return res.json(rows || []);
    } catch (err) {
        console.error('Get Clients Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 2. GET SINGLE CLIENT BY ID
async function getClientById(req, res) {
    try {
        const clientId = cleanId(req.params.id || req.params[0]);
        if (!clientId) return res.status(400).json({ success: false, message: 'Client ID required' });

        const [clients] = await pool.execute(`SELECT * FROM clients WHERE id = ?`, [clientId]);
        if (!clients || clients.length === 0) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        const [shipments] = await pool.execute(`SELECT * FROM shipments WHERE client_id = ? ORDER BY date DESC`, [clientId]);
        return res.json({
            success: true,
            client: clients[0],
            shipments: shipments || []
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. CREATE NEW CLIENT (Strictly NO ON DUPLICATE KEY UPDATE)
async function createClient(req, res) {
    try {
        const { id, name, owner } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Company / Client Name is required.' });
        }

        const cleanName = name.trim();
        const cleanOwner = owner ? owner.trim() : 'N/A';

        // Auto ID Generation without COUNT(*)
        const prefix = cleanName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'CLI';
        const randomNum = Math.floor(100 + Math.random() * 900);
        const timestampCode = Date.now().toString().slice(-3);
        const clientId = id ? id.trim() : `${prefix}-${randomNum}${timestampCode}`;

        // Check if ID already exists
        const [existing] = await pool.execute(`SELECT id FROM clients WHERE id = ?`, [clientId]);
        if (existing && existing.length > 0) {
            return res.status(409).json({ success: false, message: `Client ID '${clientId}' already exists. Duplicate creation prevented.` });
        }

        const sql = `INSERT INTO clients (id, name, owner) VALUES (?, ?, ?)`;
        await pool.execute(sql, [clientId, cleanName, cleanOwner]);

        return res.json({
            success: true,
            id: clientId,
            message: `Client '${cleanName}' created successfully in Hostinger MySQL.`
        });
    } catch (err) {
        console.error('Create Client Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. UPDATE EXISTING CLIENT
async function updateClient(req, res) {
    try {
        const clientId = cleanId(req.params.id || req.params[0]);
        const { name, owner } = req.body;

        if (!clientId) {
            return res.status(400).json({ success: false, message: 'Client ID is required.' });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Company Name is required.' });
        }

        const sql = `UPDATE clients SET name = ?, owner = ? WHERE id = ?`;
        const [result] = await pool.execute(sql, [name.trim(), (owner || 'N/A').trim(), clientId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Client not found.' });
        }

        return res.json({ success: true, message: `Client '${clientId}' updated successfully.` });
    } catch (err) {
        console.error('Update Client Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 5. DELETE CLIENT
async function deleteClient(req, res) {
    try {
        const clientId = cleanId(req.params.id || req.params[0]);

        if (!clientId) {
            return res.status(400).json({ success: false, message: 'Client ID is required.' });
        }

        const [result] = await pool.execute(`DELETE FROM clients WHERE id = ?`, [clientId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Client not found.' });
        }

        return res.json({ success: true, message: `Client '${clientId}' deleted successfully.` });
    } catch (err) {
        console.error('Delete Client Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient
};
