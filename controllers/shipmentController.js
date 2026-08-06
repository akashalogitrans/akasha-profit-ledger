/* ==========================================================================
   AKASHA LOGITRANS LLP - SHIPMENT MASTER CONTROLLER
   Strict Backend Enforcement: Payment fields controlled ONLY by Payment Module.
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

// 1. GET ALL SHIPMENTS (With Search, Month/Year/Client/Status Filters, & Pagination)
async function getShipments(req, res) {
    try {
        const { month, year, client_id, status, search, page = 1, limit = 200 } = req.query;
        const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

        let sql = `SELECT * FROM shipments WHERE 1=1`;
        const params = [];

        if (month) {
            sql += ` AND DATE_FORMAT(date, '%Y-%m') = ?`;
            params.push(month);
        }

        if (year) {
            sql += ` AND DATE_FORMAT(date, '%Y') = ?`;
            params.push(year);
        }

        if (client_id) {
            sql += ` AND client_id = ?`;
            params.push(client_id);
        }

        if (status) {
            sql += ` AND sale_status = ?`;
            params.push(status);
        }

        if (search) {
            sql += ` AND (id LIKE ? OR company_name LIKE ? OR sb_be_no LIKE ? OR client_id LIKE ? OR line_name LIKE ? OR transport_name LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q, q, q, q);
        }

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.execute(sql, params);

        const sanitizedRows = (rows || []).map(r => {
            const saleAmt = parseFloat(r.sale_amount) || 0;
            const rawRec = parseFloat(r.received_amount) || 0;
            const recAmt = Math.min(saleAmt, Math.max(0, rawRec));
            const remBal = Math.max(0, saleAmt - recAmt);
            const statusStr = recAmt >= saleAmt && saleAmt > 0 ? 'Completed' : (recAmt > 0 ? 'Partially Paid' : 'Pending');

            return {
                ...r,
                received_amount: recAmt,
                remaining_balance: remBal,
                sale_status: statusStr
            };
        });

        return res.json(sanitizedRows);
    } catch (err) {
        console.error('Get Shipments Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 2. GET SINGLE SHIPMENT BY ID
async function getShipmentById(req, res) {
    try {
        const shpId = cleanId(req.params.id || req.params[0]);
        if (!shpId) return res.status(400).json({ success: false, message: 'Shipment ID required' });

        const [rows] = await pool.execute(`SELECT * FROM shipments WHERE id = ?`, [shpId]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Shipment not found' });
        }

        const r = rows[0];
        const saleAmt = parseFloat(r.sale_amount) || 0;
        const recAmt = Math.min(saleAmt, Math.max(0, parseFloat(r.received_amount) || 0));
        const remBal = Math.max(0, saleAmt - recAmt);
        const statusStr = recAmt >= saleAmt && saleAmt > 0 ? 'Completed' : (recAmt > 0 ? 'Partially Paid' : 'Pending');

        return res.json({
            success: true,
            shipment: {
                ...r,
                received_amount: recAmt,
                remaining_balance: remBal,
                sale_status: statusStr
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. CREATE NEW SHIPMENT (Strict Backend Enforcement: received_amount=0, sale_status=Pending)
async function createShipment(req, res) {
    try {
        const { 
            id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type, 
            purchase_date, purchase_amount, purchase_status, purchase_items, 
            sale_amount, sale_items 
        } = req.body;
        
        if (!company_name || !company_name.trim()) {
            return res.status(400).json({ success: false, message: 'Company / Customer Name is required.' });
        }

        const pAmt = Math.max(0, parseFloat(purchase_amount) || 0);
        const sAmt = Math.max(0, parseFloat(sale_amount) || 0);

        if (isNaN(pAmt) || isNaN(sAmt)) {
            return res.status(400).json({ success: false, message: 'Invalid purchase or sale billing amount.' });
        }

        const profit = sAmt - pAmt;
        
        // Auto ID Generation without COUNT(*)
        const clientPrefix = client_id ? client_id.toUpperCase() : 'JOB';
        const randomCode = Math.floor(100 + Math.random() * 900);
        const timestampCode = Date.now().toString().slice(-3);
        const generatedId = `AKASHA/${clientPrefix}/${randomCode}${timestampCode}`;
        const shpId = (id && id !== 'AUTO') ? id.trim() : generatedId;

        // Check duplicate ID
        const [existing] = await pool.execute(`SELECT id FROM shipments WHERE id = ?`, [shpId]);
        if (existing && existing.length > 0) {
            return res.status(409).json({ success: false, message: `Shipment ID '${shpId}' already exists.` });
        }

        const currentDate = formatDate(date);
        const purDate = formatDate(purchase_date || currentDate);

        const pItemsStr = typeof purchase_items === 'string' ? purchase_items : JSON.stringify(purchase_items || []);
        const sItemsStr = typeof sale_items === 'string' ? sale_items : JSON.stringify(sale_items || []);

        // HARD BACKEND ENFORCEMENT: New shipments ALWAYS start with received_amount = 0, remaining_balance = sAmt, sale_status = 'Pending'
        const sql = `INSERT INTO shipments 
            (id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type, 
             purchase_date, purchase_amount, purchase_status, purchase_items, 
             payment_receive_date, sale_amount, received_amount, remaining_balance, sale_status, sale_items, net_profit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0.00, ?, 'Pending', ?, ?)`;

        await pool.execute(sql, [
            shpId, currentDate, (client_id || '').trim(), company_name.trim(), (line_name || '').trim(), (transport_name || '').trim(), 
            (sb_be_no || '').trim(), (shipment_type || 'Export Freight').trim(), purDate, pAmt, purchase_status || 'Pending', 
            pItemsStr, sAmt, sAmt, sItemsStr, profit
        ]);

        return res.json({
            success: true,
            id: shpId,
            message: `Shipment Entry '${shpId}' created successfully with initial Pending status.`
        });
    } catch (err) {
        console.error("Create Shipment Error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. UPDATE EXISTING SHIPMENT (Strict Backend Enforcement: Preserves Payment & Status History)
async function updateShipment(req, res) {
    try {
        const shpId = cleanId(req.params.id || req.params[0]);

        if (!shpId) {
            return res.status(400).json({ success: false, message: 'Shipment ID is required.' });
        }

        // Fetch existing record to PRESERVE received_amount, sale_status, and payment_receive_date
        const [existing] = await pool.execute(`SELECT * FROM shipments WHERE id = ?`, [shpId]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Shipment record not found.' });
        }

        const currentRec = rows = existing[0];
        const existingRecAmt = Math.max(0, parseFloat(currentRec.received_amount) || 0);

        const { 
            date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type, 
            purchase_date, purchase_amount, purchase_status, purchase_items, 
            sale_amount, sale_items 
        } = req.body;

        const pAmt = Math.max(0, parseFloat(purchase_amount) || 0);
        const sAmt = Math.max(0, parseFloat(sale_amount) || 0);

        if (isNaN(pAmt) || isNaN(sAmt)) {
            return res.status(400).json({ success: false, message: 'Invalid purchase or sale billing amount.' });
        }

        // Cap preserved received amount at new sale_amount
        const cappedRecAmt = Math.min(sAmt, existingRecAmt);
        const newRemBal = Math.max(0, sAmt - cappedRecAmt);
        const newStatus = cappedRecAmt >= sAmt && sAmt > 0 ? 'Completed' : (cappedRecAmt > 0 ? 'Partially Paid' : 'Pending');
        const profit = sAmt - pAmt;

        const currentDate = formatDate(date);
        const purDate = formatDate(purchase_date || currentDate);

        const pItemsStr = typeof purchase_items === 'string' ? purchase_items : JSON.stringify(purchase_items || []);
        const sItemsStr = typeof sale_items === 'string' ? sale_items : JSON.stringify(sale_items || []);

        const sql = `UPDATE shipments SET 
            date = ?, client_id = ?, company_name = ?, line_name = ?, transport_name = ?, sb_be_no = ?, shipment_type = ?, 
            purchase_date = ?, purchase_amount = ?, purchase_status = ?, purchase_items = ?,
            sale_amount = ?, received_amount = ?, remaining_balance = ?, sale_status = ?, sale_items = ?, net_profit = ?
            WHERE id = ?`;

        await pool.execute(sql, [
            currentDate, (client_id || '').trim(), (company_name || '').trim(), (line_name || '').trim(), (transport_name || '').trim(), (sb_be_no || '').trim(), (shipment_type || '').trim(), 
            purDate, pAmt, purchase_status || 'Pending', pItemsStr,
            sAmt, cappedRecAmt, newRemBal, newStatus, sItemsStr, profit, shpId
        ]);

        return res.json({
            success: true,
            message: `Shipment Entry '${shpId}' updated successfully.`
        });
    } catch (err) {
        console.error('Update Shipment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 5. DELETE SHIPMENT
async function deleteShipment(req, res) {
    try {
        const shpId = cleanId(req.params.id || req.params[0]);

        if (!shpId) {
            return res.status(400).json({ success: false, message: 'Shipment ID is required.' });
        }

        const [result] = await pool.execute(`DELETE FROM shipments WHERE id = ?`, [shpId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Shipment not found.' });
        }

        return res.json({ success: true, message: `Shipment '${shpId}' deleted successfully.` });
    } catch (err) {
        console.error('Delete Shipment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getShipments,
    getShipmentById,
    createShipment,
    updateShipment,
    deleteShipment
};
