/* ==========================================================================
   AKASHA LOGITRANS LLP - SHIPMENT MASTER CONTROLLER
   Parent Master Transaction Engine (AKASHA/{CLIENT_ID}/{RUNNING_NUMBER})
   Hardened with Central Financial Engine, Atomic Transactions & Safe JSON
   ========================================================================== */

const pool = require('../config/db');
const { ensureVendorExists } = require('./vendorController');
const { 
    safeNumber, 
    calculatePurchaseItems, 
    calculateSaleItems, 
    calculateNetProfit, 
    calculateMarginPercentage,
    parseSafeJson 
} = require('../utils/financialUtils');
const { normalizeDateOnly } = require('../utils/dateUtils');

function extractShpId(req) {
    let p = req.params ? (req.params[0] || req.params.id || req.query?.id || '') : req;
    if (!p && req && req.originalUrl) {
        const parts = req.originalUrl.split('/api/shipments/');
        if (parts.length > 1) p = parts[1].split('?')[0];
    }
    return decodeURIComponent(p || '').replace(/^\//, '').trim();
}

// 1. GET ALL SHIPMENTS (With Search, Month/Year/Client/Status Filters, & Pagination)
async function getShipments(req, res) {
    try {
        const { month, year, client_id, status, search, page = 1, limit = 200 } = req.query;
        const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

        let sql = `
            SELECT 
                s.*,
                COALESCE(vp.total_vendor_paid, 0) AS paid_amount,
                GREATEST(0, s.purchase_amount - COALESCE(vp.total_vendor_paid, 0)) AS balance_payable,
                COALESCE(pt.total_cust_rec, 0) AS total_customer_received,
                COALESCE(exp.total_direct_exp, 0) AS direct_expense_amount
            FROM shipments s
            LEFT JOIN (
                SELECT shipment_id, SUM(amount) AS total_vendor_paid 
                FROM vendor_payments 
                GROUP BY shipment_id
            ) vp ON (s.id COLLATE utf8mb4_general_ci) = (vp.shipment_id COLLATE utf8mb4_general_ci)
            LEFT JOIN (
                SELECT shipment_id, SUM(amount) AS total_cust_rec 
                FROM payment_transactions 
                GROUP BY shipment_id
            ) pt ON (s.id COLLATE utf8mb4_general_ci) = (pt.shipment_id COLLATE utf8mb4_general_ci)
            LEFT JOIN (
                SELECT shipment_id, SUM(amount) AS total_direct_exp 
                FROM expenses 
                WHERE shipment_id IS NOT NULL AND shipment_id != ''
                GROUP BY shipment_id
            ) exp ON (s.id COLLATE utf8mb4_general_ci) = (exp.shipment_id COLLATE utf8mb4_general_ci)
            WHERE 1=1
        `;
        const params = [];

        if (month) {
            sql += ` AND DATE_FORMAT(s.date, '%Y-%m') = ?`;
            params.push(month);
        }

        if (year) {
            sql += ` AND DATE_FORMAT(s.date, '%Y') = ?`;
            params.push(year);
        }

        if (client_id) {
            sql += ` AND s.client_id = ?`;
            params.push(client_id);
        }

        if (status) {
            sql += ` AND s.sale_status = ?`;
            params.push(status);
        }

        if (search) {
            sql += ` AND (s.id LIKE ? OR s.company_name LIKE ? OR s.sb_be_no LIKE ? OR s.client_id LIKE ? OR s.line_name LIKE ? OR s.transport_name LIKE ?)`;
            const q = `%${search.trim()}%`;
            params.push(q, q, q, q, q, q);
        }

        sql += ` ORDER BY s.date DESC, s.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const [rows] = await pool.execute(sql, params);

        const sanitizedRows = (rows || []).map(r => {
            const saleAmt = safeNumber(r.sale_amount, 0);
            const purAmt = safeNumber(r.purchase_amount, 0);
            const directExp = safeNumber(r.direct_expense_amount, 0);
            
            // Customer payment totals & balances
            const recAmt = Math.min(saleAmt, Math.max(safeNumber(r.total_customer_received, 0), safeNumber(r.received_amount, 0)));
            const remBal = Math.max(0, saleAmt - recAmt);
            const custStatus = r.sale_status || (recAmt >= saleAmt && saleAmt > 0 ? 'PAID' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID'));

            // Vendor payment totals & balances
            const paidAmt = Math.min(purAmt, Math.max(0, safeNumber(r.paid_amount, 0)));
            const balPay = Math.max(0, purAmt - paidAmt);
            const vendStatus = r.purchase_status || (paidAmt >= purAmt && purAmt > 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'UNPAID'));

            const profit = calculateNetProfit(saleAmt, purAmt, directExp);
            const margin = calculateMarginPercentage(saleAmt, profit);

            return {
                ...r,
                date: normalizeDateOnly(r.date),
                purchase_date: normalizeDateOnly(r.purchase_date || r.date),
                sale_amount: saleAmt,
                sales_amount: saleAmt,
                purchase_amount: purAmt,
                received_amount: recAmt,
                remaining_balance: remBal,
                balance_amount: remBal,
                sale_status: custStatus,
                customer_status: custStatus,
                paid_amount: paidAmt,
                balance_payable: balPay,
                purchase_status: vendStatus,
                vendor_status: vendStatus,
                direct_expense_amount: directExp,
                net_profit: profit,
                margin_pct: margin
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
        const saleAmt = safeNumber(r.sale_amount, 0);
        const purAmt = safeNumber(r.purchase_amount, 0);
        const recAmt = Math.min(saleAmt, Math.max(0, safeNumber(r.received_amount, 0)));
        const remBal = Math.max(0, saleAmt - recAmt);
        const profit = calculateNetProfit(saleAmt, purAmt, 0);
        const margin = calculateMarginPercentage(saleAmt, profit);

        // Fetch Payment timelines
        const [txs] = await pool.execute(`SELECT * FROM payment_transactions WHERE shipment_id = ? ORDER BY payment_date DESC, id DESC`, [shpId]);
        const [vps] = await pool.execute(`SELECT * FROM vendor_payments WHERE shipment_id = ? ORDER BY payment_date DESC, id DESC`, [shpId]);

        return res.json({
            success: true,
            shipment: {
                ...r,
                date: normalizeDateOnly(r.date),
                purchase_date: normalizeDateOnly(r.purchase_date || r.date),
                sale_amount: saleAmt,
                purchase_amount: purAmt,
                received_amount: recAmt,
                remaining_balance: remBal,
                net_profit: profit,
                margin_pct: margin
            },
            customer_payments: txs || [],
            vendor_payments: vps || []
        });
    } catch (err) {
        console.error('Get Shipment By ID Error:', err);
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
            const lastNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastNum)) nextNum = lastNum + 1;
        }

        const nextId = `${prefix}${String(nextNum).padStart(3, '0')}`;
        return res.json({ success: true, next_shipment_id: nextId, client_id: clientId });
    } catch (err) {
        console.error('Get Next Shipment ID Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. CREATE SHIPMENT JOB (Atomic Transaction + Central Financial Engine)
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
                const lastNum = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(lastNum)) nextNum = lastNum + 1;
            }
            shpId = `${prefix}${String(nextNum).padStart(3, '0')}`;
        }

        // Check duplicate ID
        const [existing] = await pool.execute(`SELECT id FROM shipments WHERE id = ?`, [shpId]);
        if (existing && existing.length > 0) {
            return res.status(409).json({ success: false, message: `Shipment ID '${shpId}' already exists.` });
        }

        // Central financial calculation for purchase and sales items
        const purCalc = calculatePurchaseItems(purchase_items);
        const saleCalc = calculateSaleItems(sale_items);
        const netProfit = calculateNetProfit(saleCalc.totalSale, purCalc.totalPurchase, 0);

        const shpDate = normalizeDateOnly(date);
        const purDate = normalizeDateOnly(purchase_date || date);
        const purItemsStr = JSON.stringify(purCalc.items);
        const saleItemsStr = JSON.stringify(saleCalc.items);

        // Auto-Ingest Vendors asynchronously
        for (const item of purCalc.items) {
            if (item.vendor_name && item.vendor_name.trim()) {
                await ensureVendorExists(item.vendor_name.trim(), item.expense_name || 'General Vendor');
            }
        }
        if (transport_name && transport_name.trim()) {
            await ensureVendorExists(transport_name.trim(), 'Transporter');
        }

        // Insert within atomic transaction with concurrency retry
        const isAutoGenerated = !id;
        let insertedId = shpId;
        let attempts = 0;
        const maxAttempts = 3;

        await pool.transaction(async (conn) => {
            while (attempts < maxAttempts) {
                try {
                    await conn.execute(
                        `INSERT INTO shipments (
                            id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type,
                            purchase_date, purchase_amount, purchase_status, purchase_items,
                            payment_receive_date, sale_amount, received_amount, remaining_balance, sale_status, sale_items, net_profit
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, NULL, ?, 0, ?, 'UNPAID', ?, ?)`,
                        [
                            insertedId, shpDate, client_id || '', company_name || '', line_name || '', transport_name || '', sb_be_no || '', shipment_type || 'EXPORT FCL',
                            purDate, purCalc.totalPurchase, purItemsStr,
                            saleCalc.totalSale, saleCalc.totalSale, saleItemsStr, netProfit
                        ]
                    );
                    break;
                } catch (insErr) {
                    if (insErr.code === 'ER_DUP_ENTRY' && isAutoGenerated && attempts < maxAttempts - 1) {
                        attempts++;
                        const prefix = `AKASHA/${client_id.trim()}/`;
                        const [rows] = await conn.execute(
                            `SELECT id FROM shipments WHERE id LIKE ? ORDER BY id DESC LIMIT 1`,
                            [`${prefix}%`]
                        );
                        let nextNum = 1;
                        if (rows && rows.length > 0) {
                            const parts = rows[0].id.split('/');
                            const lastNum = parseInt(parts[parts.length - 1], 10);
                            if (!isNaN(lastNum)) nextNum = lastNum + 1;
                        }
                        insertedId = `${prefix}${String(nextNum).padStart(3, '0')}`;
                    } else {
                        throw insErr;
                    }
                }
            }
        });

        return res.status(201).json({
            success: true,
            message: `Shipment ${insertedId} created successfully`,
            shipment_id: insertedId,
            totals: {
                sale_amount: saleCalc.totalSale,
                purchase_amount: purCalc.totalPurchase,
                net_profit: netProfit,
                margin_pct: calculateMarginPercentage(saleCalc.totalSale, netProfit)
            }
        });
    } catch (err) {
        console.error('Create Shipment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 5. UPDATE SHIPMENT (Atomic Transaction + Central Financial Engine)
async function updateShipment(req, res) {
    try {
        const shpId = extractShpId(req);
        const { date, line_name, transport_name, sb_be_no, shipment_type, purchase_date, purchase_items, sale_items } = req.body;

        const [shpRows] = await pool.execute(`SELECT received_amount FROM shipments WHERE id = ?`, [shpId]);
        if (!shpRows || shpRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Shipment not found' });
        }

        const existingRec = safeNumber(shpRows[0].received_amount, 0);

        // Central financial calculation for purchase and sales items
        const purCalc = calculatePurchaseItems(purchase_items);
        const saleCalc = calculateSaleItems(sale_items);
        const netProfit = calculateNetProfit(saleCalc.totalSale, purCalc.totalPurchase, 0);

        // Auto-Ingest Vendors
        for (const item of purCalc.items) {
            if (item.vendor_name && item.vendor_name.trim()) {
                await ensureVendorExists(item.vendor_name.trim(), item.expense_name || 'General Vendor');
            }
        }
        if (transport_name && transport_name.trim()) {
            await ensureVendorExists(transport_name.trim(), 'Transporter');
        }

        const cappedRec = Math.min(saleCalc.totalSale, existingRec);
        const remBal = Math.max(0, saleCalc.totalSale - cappedRec);
        const statusStr = cappedRec >= saleCalc.totalSale && saleCalc.totalSale > 0 ? 'PAID' : (cappedRec > 0 ? 'PARTIAL' : 'UNPAID');

        const shpDate = normalizeDateOnly(date);
        const purDate = normalizeDateOnly(purchase_date || date);
        const purItemsStr = JSON.stringify(purCalc.items);
        const saleItemsStr = JSON.stringify(saleCalc.items);

        await pool.transaction(async (conn) => {
            await conn.execute(
                `UPDATE shipments SET
                    date = ?, line_name = ?, transport_name = ?, sb_be_no = ?, shipment_type = ?,
                    purchase_date = ?, purchase_amount = ?, purchase_items = ?,
                    sale_amount = ?, remaining_balance = ?, sale_status = ?, sale_items = ?, net_profit = ?
                WHERE id = ?`,
                [
                    shpDate, line_name || '', transport_name || '', sb_be_no || '', shipment_type || 'EXPORT FCL',
                    purDate, purCalc.totalPurchase, purItemsStr,
                    saleCalc.totalSale, remBal, statusStr, saleItemsStr, netProfit,
                    shpId
                ]
            );
        });

        return res.json({
            success: true,
            message: `Shipment ${shpId} updated successfully`,
            totals: {
                sale_amount: saleCalc.totalSale,
                purchase_amount: purCalc.totalPurchase,
                net_profit: netProfit,
                margin_pct: calculateMarginPercentage(saleCalc.totalSale, netProfit)
            }
        });
    } catch (err) {
        console.error('Update Shipment Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 6. DELETE SHIPMENT (Atomic Cascade Deletion)
async function deleteShipment(req, res) {
    try {
        const shpId = extractShpId(req);
        if (!shpId) return res.status(400).json({ success: false, message: 'Shipment ID required' });

        await pool.transaction(async (conn) => {
            await conn.execute(`DELETE FROM payment_transactions WHERE shipment_id = ?`, [shpId]);
            await conn.execute(`DELETE FROM vendor_payments WHERE shipment_id = ?`, [shpId]);
            await conn.execute(`UPDATE expenses SET shipment_id = NULL WHERE shipment_id = ?`, [shpId]);
            await conn.execute(`DELETE FROM shipments WHERE id = ?`, [shpId]);
        });

        return res.json({ success: true, message: `Shipment ${shpId} deleted successfully` });
    } catch (err) {
        console.error('Delete Shipment Error:', err);
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
