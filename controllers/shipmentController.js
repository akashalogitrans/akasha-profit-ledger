/* ==========================================================================
   AKASHA LOGITRANS LLP - SHIPMENT MASTER CONTROLLER
   ========================================================================== */

const pool = require('../config/db');

function cleanId(param) {
    if (!param) return '';
    return decodeURIComponent(param).replace(/^\//, '');
}

async function getShipments(req, res) {
    try {
        const { month, search } = req.query;
        let sql = `SELECT * FROM shipments WHERE 1=1`;
        const params = [];

        if (month) {
            sql += ` AND DATE_FORMAT(date, '%Y-%m') = ?`;
            params.push(month);
        }

        if (search) {
            sql += ` AND (id LIKE ? OR company_name LIKE ? OR sb_be_no LIKE ? OR client_id LIKE ? OR line_name LIKE ?)`;
            const q = `%${search}%`;
            params.push(q, q, q, q, q);
        }

        sql += ` ORDER BY created_at DESC`;

        const [rows] = await pool.execute(sql, params);
        return res.json(rows || []);
    } catch (err) {
        console.error('Get Shipments Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function createShipment(req, res) {
    try {
        const { 
            id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type, 
            purchase_date, purchase_amount, purchase_status, purchase_items, 
            payment_receive_date, sale_amount, received_amount, sale_status, sale_items 
        } = req.body;
        
        const pAmt = parseFloat(purchase_amount) || 0;
        const sAmt = parseFloat(sale_amount) || 0;
        const recAmt = received_amount !== undefined ? parseFloat(received_amount) : (sale_status === 'Completed' ? sAmt : 0);
        const profit = sAmt - pAmt;
        
        const [countRows] = await pool.execute(`SELECT COUNT(*) as count FROM shipments`);
        const countRow = countRows[0];
        const nextCount = (countRow ? parseInt(countRow.count) : 0) + 1;
        const paddedNum = String(nextCount).padStart(3, '0');
        const cleanClientStr = client_id ? client_id.toUpperCase() : 'JOB';
        const generatedId = `AKASHA/${cleanClientStr}/${paddedNum}`;
        const shpId = (id && id !== 'AUTO') ? id : generatedId;
        const currentDate = date || new Date().toISOString().split('T')[0];

        const pItemsStr = typeof purchase_items === 'string' ? purchase_items : JSON.stringify(purchase_items || []);
        const sItemsStr = typeof sale_items === 'string' ? sale_items : JSON.stringify(sale_items || []);

        await pool.execute(`DELETE FROM shipments WHERE id = ?`, [shpId]);

        const sql = `INSERT INTO shipments 
            (id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type, purchase_date, purchase_amount, purchase_status, purchase_items, payment_receive_date, sale_amount, received_amount, sale_status, sale_items, net_profit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await pool.execute(sql, [
            shpId, currentDate, client_id || '', company_name || '', line_name || '', transport_name || '', 
            sb_be_no || '', shipment_type || '', purchase_date || currentDate, pAmt, purchase_status || 'Pending', 
            pItemsStr, payment_receive_date || currentDate, sAmt, recAmt, sale_status || 'Pending', sItemsStr, profit
        ]);

        return res.json({ success: true, id: shpId, message: 'Shipment entry saved successfully' });
    } catch (err) {
        console.error("POST Shipment Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function updateShipment(req, res) {
    try {
        const rawParam = req.params.id || req.params[0];
        const shpId = cleanId(rawParam);

        if (!shpId) {
            return res.status(400).json({ success: false, message: 'Shipment ID is required' });
        }

        const { 
            date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type, 
            purchase_date, purchase_amount, purchase_status, purchase_items, 
            payment_receive_date, sale_amount, received_amount, sale_status, sale_items 
        } = req.body;

        const pAmt = parseFloat(purchase_amount) || 0;
        const sAmt = parseFloat(sale_amount) || 0;
        const recAmt = received_amount !== undefined ? parseFloat(received_amount) : (sale_status === 'Completed' ? sAmt : 0);
        const profit = sAmt - pAmt;

        const pItemsStr = typeof purchase_items === 'string' ? purchase_items : JSON.stringify(purchase_items || []);
        const sItemsStr = typeof sale_items === 'string' ? sale_items : JSON.stringify(sale_items || []);

        const sql = `UPDATE shipments SET 
            date = ?, client_id = ?, company_name = ?, line_name = ?, transport_name = ?, sb_be_no = ?, shipment_type = ?, 
            purchase_date = ?, purchase_amount = ?, purchase_status = ?, purchase_items = ?,
            payment_receive_date = ?, sale_amount = ?, received_amount = ?, sale_status = ?, sale_items = ?, net_profit = ?
            WHERE id = ?`;

        await pool.execute(sql, [
            date, client_id || '', company_name || '', line_name || '', transport_name || '', sb_be_no || '', shipment_type || '', 
            purchase_date, pAmt, purchase_status || 'Pending', pItemsStr, payment_receive_date, sAmt, recAmt, 
            sale_status || 'Pending', sItemsStr, profit, shpId
        ]);

        return res.json({ success: true, message: 'Shipment updated successfully' });
    } catch (err) {
        console.error('Update Shipment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

async function deleteShipment(req, res) {
    try {
        const rawParam = req.params.id || req.params[0];
        const shpId = cleanId(rawParam);

        if (!shpId) {
            return res.status(400).json({ success: false, message: 'Shipment ID is required' });
        }

        await pool.execute(`DELETE FROM shipments WHERE id = ?`, [shpId]);
        return res.json({ success: true, message: 'Shipment deleted successfully' });
    } catch (err) {
        console.error('Delete Shipment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getShipments, createShipment, updateShipment, deleteShipment };
