/* ==========================================================================
   AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP BACKEND API ENGINE (NODE + SQLITE)
   ========================================================================== */

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize SQL Database
const dbPath = path.join(__dirname, 'freight_erp.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to SQL Database:', err.message);
    } else {
        console.log('Connected to SQLite Database: freight_erp.db');
        
        // Auto-create Clean Schema Tables
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(150) UNIQUE,
                password_hash VARCHAR(255),
                role VARCHAR(100),
                avatar VARCHAR(255)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS clients (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                owner VARCHAR(150) NOT NULL
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS shipments (
                id VARCHAR(50) PRIMARY KEY,
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

            // Auto-Migration for existing SQLite database file
            db.run(`ALTER TABLE shipments ADD COLUMN received_amount DECIMAL(12, 2) DEFAULT 0`, [], (err) => {
                // Ignore if column already exists
            });

            db.run(`INSERT OR IGNORE INTO users (id, name, email, password_hash, role, avatar) VALUES 
                ('usr_1', 'Khushal Patel', 'khushal@akashalogitrans.com', 'hash', 'CEO & Founder', 'https://akashalogitrans.com/khushal.png'),
                ('usr_2', 'Dhruv Patel', 'dhruv@akashalogitrans.com', 'hash', 'Director - Procurement', 'https://akashalogitrans.com/dhruv_patel.png'),
                ('usr_3', 'Yagnik Patel', 'info@akashalogitrans.com', 'hash', 'Director - Finance & Audit', 'https://akashalogitrans.com/yagnik.jpeg')`);
        });
    }
});

// HTML5 HISTORY API PAGE ROUTING (Express Catch-All Handlers for Full Pages & Nested Form Routes)
app.get(['/', '/dashboard', '/shipment-entry', '/shipment-entry/*', '/payment-received', '/purchase-entry', '/profit-ledger', '/client-master', '/client-master/*'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. AUTHENTICATION API
app.post('/api/auth/login', (req, res) => {
    const { email } = req.body;
    db.get('SELECT id, name, email, role, avatar FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
        }
        res.json({ success: true, user, token: 'jwt_token_akasha_master' });
    });
});

// 2. DASHBOARD FINANCIAL KPIS API
app.get('/api/dashboard/kpis', (req, res) => {
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
    db.get(sql, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            monthly_revenue: row ? row.total_revenue : 0,
            total_purchase: row ? row.total_purchase : 0,
            net_profit: row ? row.net_profit : 0,
            pending_payment: row ? row.pending_payment : 0
        });
    });
});

// 3. SHIPMENTS MASTER CRUD APIS
app.get('/api/shipments', (req, res) => {
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

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/shipments', (req, res) => {
    const { 
        id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type, 
        purchase_date, purchase_amount, purchase_status, purchase_items, 
        payment_receive_date, sale_amount, received_amount, sale_status, sale_items 
    } = req.body;
    
    const pAmt = parseFloat(purchase_amount) || 0;
    const sAmt = parseFloat(sale_amount) || 0;
    const recAmt = received_amount !== undefined ? parseFloat(received_amount) : (sale_status === 'Completed' ? sAmt : 0);
    const profit = sAmt - pAmt;
    
    db.get(`SELECT COUNT(*) as count FROM shipments`, [], (err, row) => {
        const nextCount = (row ? row.count : 0) + 1;
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

        db.run(sql, [shpId, currentDate, client_id, company_name, line_name || '', transport_name || '', sb_be_no, shipment_type || '', purchase_date || currentDate, pAmt, purchase_status || 'Pending', pItemsStr, payment_receive_date || currentDate, sAmt, recAmt, sale_status || 'Pending', sItemsStr, profit], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: shpId, message: 'Shipment entry saved successfully' });
        });
    });
});

app.put('/api/shipments/*', (req, res) => {
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

    db.run(sql, [date, client_id, company_name, line_name || '', transport_name || '', sb_be_no, shipment_type || '', purchase_date, pAmt, purchase_status, pItemsStr, payment_receive_date, sAmt, recAmt, sale_status, sItemsStr, profit, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Shipment updated successfully' });
    });
});

app.delete('/api/shipments/*', (req, res) => {
    const id = decodeURIComponent(req.params[0]);
    db.run(`DELETE FROM shipments WHERE id = ?`, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Shipment deleted successfully' });
    });
});

// 4. PAYMENT RECEIVED APIS
app.get('/api/payments-received', (req, res) => {
    const sql = `SELECT id AS shipment_id, client_id, company_name, payment_receive_date, sale_amount, 
                 COALESCE(received_amount, CASE WHEN sale_status = 'Completed' THEN sale_amount ELSE 0 END) AS received_amount,
                 CASE 
                     WHEN sale_status = 'Completed' THEN 0
                     WHEN COALESCE(received_amount, 0) > 0 THEN (sale_amount - received_amount)
                     ELSE sale_amount
                 END AS balance_amount, 
                 sale_status 
                 FROM shipments ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.put('/api/payments-received/*', (req, res) => {
    const id = decodeURIComponent(req.params[0]);
    const { received_amount, payment_receive_date } = req.body;
    
    db.get('SELECT sale_amount FROM shipments WHERE id = ?', [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Shipment not found' });
        
        const saleAmt = parseFloat(row.sale_amount) || 0;
        const recAmt = parseFloat(received_amount) || 0;
        const status = recAmt >= saleAmt ? 'Completed' : (recAmt > 0 ? 'Partially Paid' : 'Pending');
        const currentDate = payment_receive_date || new Date().toISOString().split('T')[0];

        const sql = `UPDATE shipments SET received_amount = ?, payment_receive_date = ?, sale_status = ? WHERE id = ?`;
        db.run(sql, [recAmt, currentDate, status, id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Payment updated successfully', received_amount: recAmt, sale_status: status });
        });
    });
});

// 5. PURCHASE ENTRY LISTING API
app.get('/api/purchases', (req, res) => {
    const sql = `SELECT id AS shipment_id, client_id, company_name, purchase_date, purchase_amount, purchase_status 
                 FROM shipments ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// 6. PROFIT LEDGER LISTING API
app.get('/api/profit-ledger', (req, res) => {
    const sql = `SELECT id AS shipment_id, client_id, company_name, purchase_amount, sale_amount, net_profit 
                 FROM shipments ORDER BY created_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const list = (rows || []).map(r => {
            const margin = r.sale_amount > 0 ? ((r.net_profit / r.sale_amount) * 100).toFixed(1) : "0.0";
            return { ...r, gross_margin: margin };
        });
        res.json(list);
    });
});

// 7. CLIENT MASTER CRUD APIS
app.get('/api/clients', (req, res) => {
    db.all(`SELECT * FROM clients ORDER BY rowid DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/clients', (req, res) => {
    const { id, name, owner } = req.body;
    db.get(`SELECT COUNT(*) as count FROM clients`, [], (err, row) => {
        const nextNum = (row ? row.count : 0) + 101;
        const prefix = name ? name.replace(/[^a-zA-Z0-9]/g, '').trim().substring(0, 3).toUpperCase() : 'CLI';
        const clientId = id || (`${prefix}-${nextNum}`);
        const sql = `INSERT INTO clients (id, name, owner) VALUES (?, ?, ?)`;
        
        db.run(sql, [clientId, name, owner || 'N/A'], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: clientId, message: 'Client created successfully' });
        });
    });
});

app.put('/api/clients/:id', (req, res) => {
    const { id } = req.params;
    const { name, owner } = req.body;
    const sql = `UPDATE clients SET name = ?, owner = ? WHERE id = ?`;
    db.run(sql, [name, owner, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Client updated successfully' });
    });
});

app.delete('/api/clients/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM clients WHERE id = ?`, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Client deleted successfully' });
    });
});

// Wildcard Fallback Route for Single Page App
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server on 0.0.0.0 for LAN Mobile Access
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Akasha LogiTrans Backend API Server running on port ${PORT}`);
    console.log(`Local Access: http://localhost:${PORT}`);
    console.log(`Mobile LAN Access: http://192.168.0.195:${PORT}`);
});
