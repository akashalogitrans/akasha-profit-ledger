/* ==========================================================================
   AKASHA LOGITRANS LLP - SHIPMENT MASTER CONTROLLER
   Parent Master Transaction Engine (AKASHA/{CLIENT_ID}/{RUNNING_NUMBER})
   ========================================================================== */

const pool = require('../config/db');

function extractShpId(req) {
    let p = req.params ? (req.params[0] || req.params.id || req.query?.id || '') : req;
    if (!p && req && req.originalUrl) {
        const parts = req.originalUrl.split('/api/shipments/');
        if (parts.length > 1) p = parts[1].split('?')[0];
    }
    return decodeURIComponent(p || '').replace(/^\//, '').trim();
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
            const purAmt = parseFloat(r.purchase_amount) || 0;
            const recAmt = Math.min(saleAmt, Math.max(0, parseFloat(r.received_amount) || 0));
            const remBal = Math.max(0, saleAmt - recAmt);
            const profit = saleAmt - purAmt;
            const margin = saleAmt > 0 ? ((profit / saleAmt) * 100).toFixed(2) : 0;
            const statusStr = r.sale_status || (recAmt >= saleAmt && saleAmt > 0 ? 'PAID' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID'));

            return {
                ...r,
                received_amount: recAmt,
                remaining_balance: remBal,
                sale_status: statusStr,
                net_profit: profit,
                margin_pct: parseFloat(margin)
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
        const shpId = extractShpId(req);
        if (!shpId) return res.status(400).json({ success: false, message: 'Shipment ID required' });

        const [rows] = await pool.execute(`SELECT * FROM shipments WHERE id = ?`, [shpId]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Shipment not found' });
        }

        const r = rows[0];
        const saleAmt = parseFloat(r.sale_amount) || 0;
        const purAmt = parseFloat(r.purchase_amount) || 0;
        const recAmt = Math.min(saleAmt, Math.max(0, parseFloat(r.received_amount) || 0));
        const remBal = Math.max(0, saleAmt - recAmt);
        const profit = saleAmt - purAmt;

        // Fetch Payment timeline
        const [txs] = await pool.execute(`SELECT * FROM payment_transactions WHERE shipment_id = ? ORDER BY payment_date DESC`, [shpId]);
        const [vps] = await pool.execute(`SELECT * FROM vendor_payments WHERE shipment_id = ? ORDER BY payment_date DESC`, [shpId]);

        return res.json({
            success: true,
            shipment: {
                ...r,
                received_amount: recAmt,
                remaining_balance: remBal,
                net_profit: profit
            },
            customer_payments: txs || [],
            vendor_payments: vps || []
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. GENERATE NEXT SHIPMENT ID FOR A CLIENT (e.g. AKASHA/CLI-101/001)
async function getNextShipmentId(req, res) {
    try {
        const clientId = req.query.client_id || 'CLI-101';
        const prefix = `AKASHA/${clientId.trim()}/`;

        const [rows] = await pool.execute(
            `SELECT id FROM shipments WHERE id LIKE ? ORDER BY id DESC LIMIT 1`,
            [`${prefix}%`]
        );

        let nextNum = 1;
        if (rows && rows.length > 0) {
            const parts = rows[0].id.split('/');
            const lastNum = parseInt(parts[parts.length - 1]);
            if (!isNaN(lastNum)) nextNum = lastNum + 1;
        }

        const nextId = `${prefix}${String(nextNum).padStart(3, '0')}`;
        return res.json({ success: true, next_shipment_id: nextId, client_id: clientId });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. CREATE SHIPMENT JOB
async function createShipment(req, res) {
    try {
        let {
            id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type,
            purchase_date, purchase_items,
            sale_items
        } = req.body;

        if (!client_id || !company_name) {
            return res.status(400).json({ success: false, message: 'Client ID and Client Company Name are required.' });
        }

        // Auto Generate ID if not provided: AKASHA/CLI-101/001
        let shpId = id ? id.trim() : '';
        if (!shpId) {
            const prefix = `AKASHA/${client_id.trim()}/`;
            const [rows] = await pool.execute(
                `SELECT id FROM shipments WHERE id LIKE ? ORDER BY id DESC LIMIT 1`,
                [`${prefix}%`]
            );
            let nextNum = 1;
            if (rows && rows.length > 0) {
                const parts = rows[0].id.split('/');
                const lastNum = parseInt(parts[parts.length - 1]);
                if (!isNaN(lastNum)) nextNum = lastNum + 1;
            }
            shpId = `${prefix}${String(nextNum).padStart(3, '0')}`;
        }

        // Check duplicate ID
        const [existing] = await pool.execute(`SELECT id FROM shipments WHERE id = ?`, [shpId]);
        if (existing && existing.length > 0) {
            return res.status(409).json({ success: false, message: `Shipment ID '${shpId}' already exists.` });
        }

        // Calculate Purchase & Sales Totals from Items Array
        let calcPurTotal = 0;
        let parsedPurItems = [];
        if (purchase_items) {
            parsedPurItems = typeof purchase_items === 'string' ? JSON.parse(purchase_items) : purchase_items;
            parsedPurItems.forEach(item => {
                calcPurTotal += (parseFloat(item.amount) || parseFloat(item.total_amount) || 0);
            });
        }

        let calcSaleTotal = 0;
        let parsedSaleItems = [];
        if (sale_items) {
            parsedSaleItems = typeof sale_items === 'string' ? JSON.parse(sale_items) : sale_items;
            parsedSaleItems.forEach(item => {
                const q = parseFloat(item.qty) || 1;
                const r = parseFloat(item.rate) || parseFloat(item.amount) || 0;
                const lineTot = item.amount ? parseFloat(item.amount) : (q * r);
                calcSaleTotal += lineTot;
            });
        }

        const netProfit = calcSaleTotal - calcPurTotal;
        const shpDate = formatDate(date);
        const purDate = formatDate(purchase_date || date);
        const purItemsStr = JSON.stringify(parsedPurItems);
        const saleItemsStr = JSON.stringify(parsedSaleItems);

        await pool.execute(
            `INSERT INTO shipments (
                id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type,
                purchase_date, purchase_amount, purchase_status, purchase_items,
                payment_receive_date, sale_amount, received_amount, remaining_balance, sale_status, sale_items, net_profit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, NULL, ?, 0, ?, 'UNPAID', ?, ?)`,
            [
                shpId, shpDate, client_id, company_name, line_name || '', transport_name || '', sb_be_no || '', shipment_type || 'Export FCL',
                purDate, calcPurTotal, purItemsStr,
                calcSaleTotal, calcSaleTotal, saleItemsStr, netProfit
            ]
        );

        return res.status(201).json({
            success: true,
            message: `Shipment ${shpId} created successfully`,
            shipment_id: shpId,
            totals: {
                sale_amount: calcSaleTotal,
                purchase_amount: calcPurTotal,
                net_profit: netProfit
            }
        });
    } catch (err) {
        console.error('Create Shipment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 5. UPDATE SHIPMENT
async function updateShipment(req, res) {
    try {
        const shpId = extractShpId(req);
        const { date, line_name, transport_name, sb_be_no, shipment_type, purchase_date, purchase_items, sale_items } = req.body;

        const [shpRows] = await pool.execute(`SELECT received_amount FROM shipments WHERE id = ?`, [shpId]);
        if (!shpRows || shpRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Shipment not found' });
        }

        const existingRec = parseFloat(shpRows[0].received_amount) || 0;

        let calcPurTotal = 0;
        let parsedPurItems = [];
        if (purchase_items) {
            parsedPurItems = typeof purchase_items === 'string' ? JSON.parse(purchase_items) : purchase_items;
            parsedPurItems.forEach(item => {
                calcPurTotal += (parseFloat(item.amount) || parseFloat(item.total_amount) || 0);
            });
        }

        let calcSaleTotal = 0;
        let parsedSaleItems = [];
        if (sale_items) {
            parsedSaleItems = typeof sale_items === 'string' ? JSON.parse(sale_items) : sale_items;
            parsedSaleItems.forEach(item => {
                const q = parseFloat(item.qty) || 1;
                const r = parseFloat(item.rate) || parseFloat(item.amount) || 0;
                const lineTot = item.amount ? parseFloat(item.amount) : (q * r);
                calcSaleTotal += lineTot;
            });
        }

        const cappedRec = Math.min(calcSaleTotal, existingRec);
        const remBal = Math.max(0, calcSaleTotal - cappedRec);
        const netProfit = calcSaleTotal - calcPurTotal;
        const statusStr = cappedRec >= calcSaleTotal && calcSaleTotal > 0 ? 'PAID' : (cappedRec > 0 ? 'PARTIAL' : 'UNPAID');

        await pool.execute(
            `UPDATE shipments SET
                date = ?, line_name = ?, transport_name = ?, sb_be_no = ?, shipment_type = ?,
                purchase_date = ?, purchase_amount = ?, purchase_items = ?,
                sale_amount = ?, remaining_balance = ?, sale_status = ?, sale_items = ?, net_profit = ?
            WHERE id = ?`,
            [
                formatDate(date), line_name, transport_name, sb_be_no, shipment_type,
                formatDate(purchase_date || date), calcPurTotal, JSON.stringify(parsedPurItems),
                calcSaleTotal, remBal, statusStr, JSON.stringify(parsedSaleItems), netProfit,
                shpId
            ]
        );

        return res.json({ success: true, message: `Shipment ${shpId} updated successfully` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 6. DELETE SHIPMENT
async function deleteShipment(req, res) {
    try {
        const shpId = extractShpId(req);
        if (!shpId) return res.status(400).json({ success: false, message: 'Shipment ID required' });

        await pool.execute(`DELETE FROM payment_transactions WHERE shipment_id = ?`, [shpId]);
        await pool.execute(`DELETE FROM vendor_payments WHERE shipment_id = ?`, [shpId]);
        await pool.execute(`DELETE FROM shipments WHERE id = ?`, [shpId]);

        return res.json({ success: true, message: `Shipment ${shpId} deleted successfully` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getShipments,
    getShipmentById,
    getNextShipmentId,
    createShipment,
    updateShipment,
    deleteShipment
};
