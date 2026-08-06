/* ==========================================================================
   AKASHA LOGITRANS LLP - SHIPMENT MASTER CONTROLLER
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
        const sanitizedRows = (rows || []).map(r => {
            const saleAmt = parseFloat(r.sale_amount) || 0;
            const rawRec = r.received_amount !== undefined ? parseFloat(r.received_amount) : (r.sale_status === 'Completed' ? saleAmt : 0);
            const recAmt = Math.min(saleAmt, Math.max(0, rawRec));
            return { ...r, received_amount: recAmt };
        });
        return res.json(sanitizedRows);
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

        const currentDate = formatDate(date);
        const purDate = formatDate(purchase_date || currentDate);
        const payDate = formatDate(payment_receive_date || currentDate);

        const pItemsStr = typeof purchase_items === 'string' ? purchase_items : JSON.stringify(purchase_items || []);
        const sItemsStr = typeof sale_items === 'string' ? sale_items : JSON.stringify(sale_items || []);

        const sql = `INSERT INTO shipments 
            (id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type, purchase_date, purchase_amount, purchase_status, purchase_items, payment_receive_date, sale_amount, received_amount, sale_status, sale_items, net_profit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            date = VALUES(date), client_id = VALUES(client_id), company_name = VALUES(company_name), line_name = VALUES(line_name), transport_name = VALUES(transport_name), sb_be_no = VALUES(sb_be_no), shipment_type = VALUES(shipment_type), purchase_date = VALUES(purchase_date), purchase_amount = VALUES(purchase_amount), purchase_status = VALUES(purchase_status), purchase_items = VALUES(purchase_items), payment_receive_date = VALUES(payment_receive_date), sale_amount = VALUES(sale_amount), received_amount = VALUES(received_amount), sale_status = VALUES(sale_status), sale_items = VALUES(sale_items), net_profit = VALUES(net_profit)`;

        await pool.execute(sql, [
            shpId, currentDate, client_id || '', company_name || '', line_name || '', transport_name || '', 
            sb_be_no || '', shipment_type || '', purDate, pAmt, purchase_status || 'Pending', 
            pItemsStr, payDate, sAmt, recAmt, sale_status || 'Pending', sItemsStr, profit
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

        const currentDate = formatDate(date);
        const purDate = formatDate(purchase_date || currentDate);
        const payDate = formatDate(payment_receive_date || currentDate);

        const pItemsStr = typeof purchase_items === 'string' ? purchase_items : JSON.stringify(purchase_items || []);
        const sItemsStr = typeof sale_items === 'string' ? sale_items : JSON.stringify(sale_items || []);

        const sql = `UPDATE shipments SET 
            date = ?, client_id = ?, company_name = ?, line_name = ?, transport_name = ?, sb_be_no = ?, shipment_type = ?, 
            purchase_date = ?, purchase_amount = ?, purchase_status = ?, purchase_items = ?,
            payment_receive_date = ?, sale_amount = ?, received_amount = ?, sale_status = ?, sale_items = ?, net_profit = ?
            WHERE id = ?`;

        await pool.execute(sql, [
            currentDate, client_id || '', company_name || '', line_name || '', transport_name || '', sb_be_no || '', shipment_type || '', 
            purDate, pAmt, purchase_status || 'Pending', pItemsStr, payDate, sAmt, recAmt, 
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
