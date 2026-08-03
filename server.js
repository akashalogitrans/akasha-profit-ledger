/* ==========================================================================
   AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP BACKEND API ENGINE
   Dual Driver: Hostinger MySQL & SQLite3 Support
   ========================================================================== */

try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- DATABASE DRIVER DETECTOR (HOSTINGER MYSQL VS LOCAL SQLITE) ---
const IS_MYSQL = !!(process.env.DB_HOST || process.env.MYSQL_HOST);

let mysqlPool = null;
let sqliteDb = null;

if (IS_MYSQL) {
    const mysql = require('mysql2/promise');
    mysqlPool = mysql.createPool({
        host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
        user: process.env.DB_USER || process.env.MYSQL_USER,
        password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
        database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log('Connected to Hostinger MySQL Database:', process.env.DB_NAME || process.env.MYSQL_DATABASE);
} else {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, 'freight_erp.db');
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error connecting to SQLite Database:', err.message);
        } else {
            console.log('Connected to SQLite Database: freight_erp.db');
            
            // Auto-create Clean Schema Tables for SQLite
            sqliteDb.serialize(() => {
                sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(100),
                    email VARCHAR(150) UNIQUE,
                    password_hash VARCHAR(255),
                    role VARCHAR(100),
                    avatar VARCHAR(255)
                )`);

                sqliteDb.run(`CREATE TABLE IF NOT EXISTS clients (
                    id VARCHAR(50) PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    owner VARCHAR(150) NOT NULL
                )`);

                sqliteDb.run(`CREATE TABLE IF NOT EXISTS shipments (
                    id VARCHAR(100) PRIMARY KEY,
                    date DATE NOT NULL,
                    client_id VARCHAR(50),
                    company_name VARCHAR(200),
                    line_name VARCHAR(150),
                    transport_name VARCHAR(150),
                    sb_be_no VARCHAR(100),
                    shipment_type VARCHAR(50),
                    purchase_date DATE,
                    purchase_amount DECIMAL(12, 2) DEFAULT 0,
                    purchase_status VARCHAR(30) DEFAULT 'Pending',
                    purchase_items TEXT,
                    payment_receive_date DATE,
                    sale_amount DECIMAL(12, 2) DEFAULT 0,
                    received_amount DECIMAL(12, 2) DEFAULT 0,
                    sale_status VARCHAR(30) DEFAULT 'Pending',
                    sale_items TEXT,
                    net_profit DECIMAL(12, 2) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);

                sqliteDb.run(`INSERT OR IGNORE INTO users (id, name, email, password_hash, role, avatar) VALUES 
                    ('usr_1', 'Khushal Patel', 'khushal@akashalogitrans.com', 'hash', 'CEO & Founder', 'https://akashalogitrans.com/khushal.png'),
                    ('usr_2', 'Dhruv Patel', 'dhruv@akashalogitrans.com', 'hash', 'Director - Procurement', 'https://akashalogitrans.com/dhruv_patel.png'),
                    ('usr_3', 'Yagnik Patel', 'info@akashalogitrans.com', 'hash', 'Director - Finance & Audit', 'https://akashalogitrans.com/yagnik.jpeg')`);
            });
        }
    });
}

// --- ASYNCHRONOUS DATABASE ABSTRACTION HELPERS ---
function dbAll(sql, params = []) {
    if (IS_MYSQL) {
        const convertedSql = sql.replace(/strftime\('%Y-%m',\s*date\)/g, "DATE_FORMAT(date, '%Y-%m')");
        return mysqlPool.execute(convertedSql, params).then(([rows]) => rows);
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.all(sql, params, (err, rows) => {
                if (err) reject(err); else resolve(rows || []);
            });
        });
    }
}

function dbGet(sql, params = []) {
    if (IS_MYSQL) {
        const convertedSql = sql.replace(/strftime\('%Y-%m',\s*date\)/g, "DATE_FORMAT(date, '%Y-%m')");
        return mysqlPool.execute(convertedSql, params).then(([rows]) => rows[0]);
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.get(sql, params, (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });
    }
}

function dbRun(sql, params = []) {
    if (IS_MYSQL) {
        return mysqlPool.execute(sql, params).then(([result]) => result);
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.run(sql, params, function(err) {
                if (err) reject(err); else resolve(this);
            });
        });
    }
}

// HTML5 HISTORY API PAGE ROUTING
app.get(['/', '/dashboard', '/shipment-entry', '/shipment-entry/*', '/payment-received', '/purchase-entry', '/profit-ledger', '/client-master', '/client-master/*'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. AUTHENTICATION API
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await dbGet('SELECT id, name, email, role, avatar FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
        }
        res.json({ success: true, user, token: 'jwt_token_akasha_master' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. DASHBOARD FINANCIAL KPIS API
app.get('/api/dashboard/kpis', async (req, res) => {
    try {
        const sql = `
            SELECT 
                COALESCE(SUM(sale_amount), 0) AS total_revenue,
                COALESCE(SUM(purchase_amount), 0) AS total_purchase,
                COALESCE(SUM(net_profit), 0) AS net_profit,
                COALESCE(SUM(
                    CASE 
                        WHEN sale_status = 'Completed' THEN 0 
                        WHEN COALESCE(received_amount, 0) > 0 THEN (sale_amount - received_amount)
                        ELSE sale_amount 
                    END
                ), 0) AS pending_payment
            FROM shipments
        `;
        const row = await dbGet(sql, []);
        res.json({
            monthly_revenue: row ? parseFloat(row.total_revenue) || 0 : 0,
            total_purchase: row ? parseFloat(row.total_purchase) || 0 : 0,
            net_profit: row ? parseFloat(row.net_profit) || 0 : 0,
            pending_payment: row ? parseFloat(row.pending_payment) || 0 : 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. SHIPMENTS MASTER CRUD APIS
app.get('/api/shipments', async (req, res) => {
    try {
        const { month, search } = req.query;
        let sql = `SELECT * FROM shipments WHERE 1=1`;
        const params = [];

        if (month) {
            sql += ` AND strftime('%Y-%m', date) = ?`;
            params.push(month);
        }
        if (search) {
            sql += ` AND (id LIKE ? OR company_name LIKE ? OR sb_be_no LIKE ? OR client_id LIKE ? OR line_name LIKE ?)`;
            const q = `%${search}%`;
            params.push(q, q, q, q, q);
        }
        sql += ` ORDER BY created_at DESC`;

        const rows = await dbAll(sql, params);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shipments', async (req, res) => {
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
        
        const countRow = await dbGet(`SELECT COUNT(*) as count FROM shipments`, []);
        const nextCount = (countRow ? parseInt(countRow.count) : 0) + 1;
        const paddedNum = String(nextCount).padStart(3, '0');
        const cleanClient = client_id ? client_id.toUpperCase() : 'JOB';
        const generatedId = `AKASHA/${cleanClient}/${paddedNum}`;
        const shpId = (id && id !== 'AUTO') ? id : generatedId;
        const currentDate = date || new Date().toISOString().split('T')[0];

        const pItemsStr = typeof purchase_items === 'string' ? purchase_items : JSON.stringify(purchase_items || []);
        const sItemsStr = typeof sale_items === 'string' ? sale_items : JSON.stringify(sale_items || []);

        const sql = `INSERT INTO shipments 
            (id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type, purchase_date, purchase_amount, purchase_status, purchase_items, payment_receive_date, sale_amount, received_amount, sale_status, sale_items, net_profit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await dbRun(sql, [shpId, currentDate, client_id, company_name, line_name || '', transport_name || '', sb_be_no, shipment_type || '', purchase_date || currentDate, pAmt, purchase_status || 'Pending', pItemsStr, payment_receive_date || currentDate, sAmt, recAmt, sale_status || 'Pending', sItemsStr, profit]);
        res.json({ success: true, id: shpId, message: 'Shipment entry saved successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/shipments/*', async (req, res) => {
    try {
        const id = decodeURIComponent(req.params[0]);
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

        await dbRun(sql, [date, client_id, company_name, line_name || '', transport_name || '', sb_be_no, shipment_type || '', purchase_date, pAmt, purchase_status, pItemsStr, payment_receive_date, sAmt, recAmt, sale_status, sItemsStr, profit, id]);
        res.json({ success: true, message: 'Shipment updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/shipments/*', async (req, res) => {
    try {
        const id = decodeURIComponent(req.params[0]);
        await dbRun(`DELETE FROM shipments WHERE id = ?`, [id]);
        res.json({ success: true, message: 'Shipment deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. PAYMENT RECEIVED APIS
app.get('/api/payments-received', async (req, res) => {
    try {
        const sql = `SELECT id AS shipment_id, client_id, company_name, payment_receive_date, sale_amount, 
                     COALESCE(received_amount, CASE WHEN sale_status = 'Completed' THEN sale_amount ELSE 0 END) AS received_amount,
                     CASE 
                         WHEN sale_status = 'Completed' THEN 0
                         WHEN COALESCE(received_amount, 0) > 0 THEN (sale_amount - received_amount)
                         ELSE sale_amount
                     END AS balance_amount, 
                     sale_status 
                     FROM shipments ORDER BY created_at DESC`;
        const rows = await dbAll(sql, []);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/payments-received/*', async (req, res) => {
    try {
        const id = decodeURIComponent(req.params[0]);
        const { received_amount, payment_receive_date } = req.body;
        
        const row = await dbGet('SELECT sale_amount FROM shipments WHERE id = ?', [id]);
        if (!row) return res.status(404).json({ error: 'Shipment not found' });
        
        const saleAmt = parseFloat(row.sale_amount) || 0;
        const recAmt = parseFloat(received_amount) || 0;
        const status = recAmt >= saleAmt ? 'Completed' : (recAmt > 0 ? 'Partially Paid' : 'Pending');
        const currentDate = payment_receive_date || new Date().toISOString().split('T')[0];

        const sql = `UPDATE shipments SET received_amount = ?, payment_receive_date = ?, sale_status = ? WHERE id = ?`;
        await dbRun(sql, [recAmt, currentDate, status, id]);
        res.json({ success: true, message: 'Payment updated successfully', received_amount: recAmt, sale_status: status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. PURCHASE ENTRY LISTING API
app.get('/api/purchases', async (req, res) => {
    try {
        const sql = `SELECT id AS shipment_id, client_id, company_name, purchase_date, purchase_amount, purchase_status 
                     FROM shipments ORDER BY created_at DESC`;
        const rows = await dbAll(sql, []);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. PROFIT LEDGER LISTING API
app.get('/api/profit-ledger', async (req, res) => {
    try {
        const sql = `SELECT id AS shipment_id, client_id, company_name, purchase_amount, sale_amount, net_profit 
                     FROM shipments ORDER BY created_at DESC`;
        const rows = await dbAll(sql, []);
        const list = (rows || []).map(r => {
            const sAmt = parseFloat(r.sale_amount) || 0;
            const pft = parseFloat(r.net_profit) || 0;
            const margin = sAmt > 0 ? ((pft / sAmt) * 100).toFixed(1) : "0.0";
            return { ...r, gross_margin: margin };
        });
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. CLIENT MASTER CRUD APIS
app.get('/api/clients', async (req, res) => {
    try {
        const rows = await dbAll(`SELECT * FROM clients`, []);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clients', async (req, res) => {
    try {
        const { id, name, owner } = req.body;
        const countRow = await dbGet(`SELECT COUNT(*) as count FROM clients`, []);
        const nextNum = (countRow ? parseInt(countRow.count) : 0) + 101;
        const prefix = name ? name.replace(/[^a-zA-Z0-9]/g, '').trim().substring(0, 3).toUpperCase() : 'CLI';
        const clientId = id || (`${prefix}-${nextNum}`);
        const sql = `INSERT INTO clients (id, name, owner) VALUES (?, ?, ?)`;
        
        await dbRun(sql, [clientId, name, owner || 'N/A']);
        res.json({ success: true, id: clientId, message: 'Client created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, owner } = req.body;
        const sql = `UPDATE clients SET name = ?, owner = ? WHERE id = ?`;
        await dbRun(sql, [name, owner, id]);
        res.json({ success: true, message: 'Client updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await dbRun(`DELETE FROM clients WHERE id = ?`, [id]);
        res.json({ success: true, message: 'Client deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Wildcard Fallback Route for Single Page App
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server on 0.0.0.0 for LAN & Cloud Access
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Akasha LogiTrans Backend API Server running on port ${PORT}`);
    console.log(`Local Access: http://localhost:${PORT}`);
});
