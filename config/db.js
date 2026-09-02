/* ==========================================================================
   AKASHA LOGITRANS LLP - MYSQL DATABASE CONNECTION POOL CONFIG
   Hostinger Database Resolver + Local Fallback Bridge
   ========================================================================== */

const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcryptjs');

try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (e) {}

// Connection Config Options
const host = process.env.DB_HOST || process.env.HOST || '127.0.0.1';
const port = parseInt(process.env.DB_PORT || '3306');
const password = process.env.DB_PASSWORD || process.env.PASSWORD || 'Alt@7776';
const database = process.env.DB_NAME || process.env.DATABASE || 'u614117022_erp_database';
const user = process.env.DB_USER || process.env.USERNAME || 'u614117022_erp';

const dbConfig = {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 25,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    dateStrings: true
};

console.log(`[MySQL Config] Connecting to Hostinger Database: ${dbConfig.database} @ ${host}:${port}`);

let mysqlPool = mysql.createPool(dbConfig);
let isDbConnected = false;

// Safe Proxy Object wrapping pool.execute and pool.query with Auto-Reconnect, Transaction Support & Retry
const pool = {
    async query(sql, params = []) {
        return this.execute(sql, params);
    },
    async execute(sql, params = [], retries = 3) {
        const safeParams = (params || []).map(p => (p === undefined ? null : p));
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await mysqlPool.execute(sql, safeParams);
            } catch (err) {
                const isConnErr = err.code === 'ECONNRESET' || 
                                  err.code === 'PROTOCOL_CONNECTION_LOST' || 
                                  err.code === 'ETIMEDOUT' || 
                                  err.code === 'ECONNREFUSED' ||
                                  err.code === 'EHOSTUNREACH' ||
                                  (err.message && (err.message.includes('closed state') || err.message.includes('Connection lost')));

                if (isConnErr && attempt < retries) {
                    console.warn(`[MySQL Reconnect] Hostinger DB connection glitch (${err.code || err.message}). Auto-retrying query attempt ${attempt}/${retries}...`);
                    try {
                        mysqlPool = mysql.createPool(dbConfig);
                    } catch (pErr) {}
                    await new Promise(res => setTimeout(res, 400 * attempt));
                    continue;
                }

                console.error('[MySQL Query Error]:', err.message, '| Query:', sql);
                throw err;
            }
        }
    },
    async getConnection() {
        return await mysqlPool.getConnection();
    },
    async transaction(callback) {
        const conn = await mysqlPool.getConnection();
        try {
            await conn.beginTransaction();
            const result = await callback(conn);
            await conn.commit();
            return result;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }
};

// Auto Verify Connection & Auto-Migrate Database Schema
(async () => {
    try {
        await mysqlPool.query('SELECT 1');
        isDbConnected = true;
        console.log(`✅ [Hostinger MySQL Pool Connected] DB: ${dbConfig.database} @ ${host}:${port}`);
        await runAutoMigration();
    } catch (err) {
        isDbConnected = false;
        console.error(`❌ [Hostinger MySQL Connection Failed]: ${err.message}`);
    }
})();

async function runAutoMigration() {
    try {
        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS directors (
            id VARCHAR(50) PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, email VARCHAR(150) NOT NULL UNIQUE,
            phone VARCHAR(50), pin_hash VARCHAR(255) NOT NULL, role VARCHAR(100) DEFAULT 'Director', avatar VARCHAR(255), status VARCHAR(20) DEFAULT 'Active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        try {
            await mysqlPool.query(`ALTER TABLE directors ADD COLUMN IF NOT EXISTS phone VARCHAR(50) AFTER email`);
        } catch (e) {}

        const h8866 = await bcrypt.hash('8866', 10);
        const h7776 = await bcrypt.hash('7776', 10);
        const h7717 = await bcrypt.hash('7717', 10);

        // Ensure the exact 3 directors exist and are up to date
        await mysqlPool.query(`
            INSERT INTO directors (id, name, email, phone, pin_hash, role, avatar) VALUES
            ('dir_1', 'KHUSHAL VASOYA', 'khushal@akashalogitrans.com', '9328227962', ?, 'CEO & Founder', 'https://akashalogitrans.com/khushal.png'),
            ('dir_2', 'DHRUV THESHIYA', 'dhruv@akashalogitrans.com', '8155068853', ?, 'Director - Rates & Procurement', 'https://akashalogitrans.com/dhruv_patel.png'),
            ('dir_3', 'YAGNIK SORATHIYA', 'info@akashalogitrans.com', '9924929129', ?, 'Director - Finance & Audit', 'https://akashalogitrans.com/yagnik.jpeg')
            ON DUPLICATE KEY UPDATE
            name = VALUES(name), phone = VALUES(phone), pin_hash = VALUES(pin_hash), role = VALUES(role), avatar = VALUES(avatar)
        `, [h7776, h7717, h8866]);

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS clients (
            id VARCHAR(50) PRIMARY KEY, name VARCHAR(200) NOT NULL, contact_person VARCHAR(100), mobile VARCHAR(50), email VARCHAR(150), gstin VARCHAR(50), pan VARCHAR(50), address TEXT, credit_terms VARCHAR(50), opening_balance DECIMAL(14,2) DEFAULT 0, status VARCHAR(20) DEFAULT 'ACTIVE', owner VARCHAR(150) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS vendors (
            id VARCHAR(50) PRIMARY KEY, name VARCHAR(200) NOT NULL, vendor_type VARCHAR(100) DEFAULT 'General Vendor', contact_person VARCHAR(100), mobile VARCHAR(50), email VARCHAR(150), gstin VARCHAR(50), pan VARCHAR(50), address TEXT, bank_details TEXT, credit_terms VARCHAR(50), status VARCHAR(20) DEFAULT 'ACTIVE', remarks TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS services (
            id VARCHAR(50) PRIMARY KEY, service_name VARCHAR(150) NOT NULL UNIQUE, service_type VARCHAR(100) DEFAULT 'General', default_gst_pct DECIMAL(5,2) DEFAULT 18.00, status VARCHAR(20) DEFAULT 'ACTIVE', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS shipments (
            id VARCHAR(100) PRIMARY KEY, date DATE NOT NULL, client_id VARCHAR(50), company_name VARCHAR(200),
            line_name VARCHAR(150), transport_name VARCHAR(150), sb_be_no VARCHAR(100), shipment_type VARCHAR(50),
            purchase_date DATE, purchase_amount DECIMAL(14, 2) DEFAULT 0, purchase_status VARCHAR(30) DEFAULT 'UNPAID', purchase_items TEXT,
            payment_receive_date DATE, sale_amount DECIMAL(14, 2) DEFAULT 0, received_amount DECIMAL(14, 2) DEFAULT 0, remaining_balance DECIMAL(14, 2) DEFAULT 0,
            sale_status VARCHAR(30) DEFAULT 'UNPAID', sale_items TEXT, net_profit DECIMAL(14, 2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS payment_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY, shipment_id VARCHAR(100) NOT NULL, payment_date DATE NOT NULL, amount DECIMAL(14, 2) NOT NULL,
            payment_mode VARCHAR(50) DEFAULT 'Bank Transfer', bank VARCHAR(100) DEFAULT 'HDFC Bank', utr VARCHAR(100), remarks TEXT, created_by VARCHAR(100) DEFAULT 'Director', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS vendor_payments (
            id INT AUTO_INCREMENT PRIMARY KEY, shipment_id VARCHAR(100) NOT NULL, vendor_id VARCHAR(50), vendor_name VARCHAR(200), bill_no VARCHAR(100), payment_date DATE NOT NULL, amount DECIMAL(14, 2) NOT NULL,
            payment_mode VARCHAR(50) DEFAULT 'NEFT', bank VARCHAR(100) DEFAULT 'HDFC Bank', reference_no VARCHAR(100), remarks TEXT, created_by VARCHAR(100) DEFAULT 'Director', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS expenses (
            id VARCHAR(50) PRIMARY KEY, shipment_id VARCHAR(100) NULL, expense_date DATE NOT NULL, category VARCHAR(100) NOT NULL,
            paid_to VARCHAR(200) NOT NULL, amount DECIMAL(14,2) NOT NULL DEFAULT 0.00, payment_mode VARCHAR(50) DEFAULT 'Bank Transfer',
            reference_no VARCHAR(100), purpose TEXT, recorded_by VARCHAR(100) DEFAULT 'Director',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);

        try {
            await mysqlPool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS shipment_id VARCHAR(100) NULL AFTER id`);
        } catch (e) {}

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS login_logs (
            id INT AUTO_INCREMENT PRIMARY KEY, user_name VARCHAR(100), ip VARCHAR(50), browser TEXT, status VARCHAR(50), login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY, user_name VARCHAR(100), action VARCHAR(100), target_type VARCHAR(50), target_id VARCHAR(100), details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        try {
            await mysqlPool.query(`ALTER TABLE shipments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
            await mysqlPool.query(`ALTER TABLE payment_transactions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
            await mysqlPool.query(`ALTER TABLE vendor_payments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
        } catch (cErr) {}

        console.log('✅ [Hostinger MySQL Tables Auto-Migrated & Verified Active]');
    } catch (e) {
        console.error('Migration Warning:', e.message);
    }
}

// Handler for fallback queries when running offline/locally without MySQL connection
function handleLocalFallbackQuery(sql, params) {
    const s = sql.toLowerCase().trim();

    // 1. DELETE QUERIES (MUST BE EVALUATED FIRST BEFORE SELECT!)
    if (s.startsWith('delete from shipments') || s.includes('delete from shipments')) {
        if (params && params.length > 0) {
            const delId = String(params[0]).toLowerCase().trim();
            localStore.shipments = localStore.shipments.filter(shp => String(shp.id).toLowerCase().trim() !== delId);
        }
        return [{ affectedRows: 1 }, []];
    }
    if (s.startsWith('delete from payment_transactions') || s.includes('delete from payment_transactions')) {
        if (params && params.length > 0) {
            const delId = String(params[0]).toLowerCase().trim();
            localStore.payment_transactions = localStore.payment_transactions.filter(tx => String(tx.shipment_id).toLowerCase().trim() !== delId && String(tx.id).toLowerCase().trim() !== delId);
        }
        return [{ affectedRows: 1 }, []];
    }
    if (s.startsWith('delete from vendor_payments') || s.includes('delete from vendor_payments')) {
        if (params && params.length > 0) {
            const delId = String(params[0]).toLowerCase().trim();
            localStore.vendor_payments = localStore.vendor_payments.filter(vp => String(vp.shipment_id).toLowerCase().trim() !== delId && String(vp.id).toLowerCase().trim() !== delId);
        }
        return [{ affectedRows: 1 }, []];
    }
    if (s.startsWith('delete from clients') || s.includes('delete from clients')) {
        if (params && params.length > 0) {
            const delId = String(params[0]).toLowerCase().trim();
            localStore.clients = localStore.clients.filter(c => String(c.id).toLowerCase().trim() !== delId);
        }
        return [{ affectedRows: 1 }, []];
    }
    if (s.startsWith('delete from vendors') || s.includes('delete from vendors')) {
        if (params && params.length > 0) {
            const delId = String(params[0]).toLowerCase().trim();
            localStore.vendors = localStore.vendors.filter(v => String(v.id).toLowerCase().trim() !== delId);
        }
        return [{ affectedRows: 1 }, []];
    }
    if (s.startsWith('delete from')) {
        return [{ affectedRows: 1 }, []];
    }

    // 2. INSERT QUERIES
    if (s.includes('insert into clients')) {
        const newClient = { id: params[0], name: params[1], contact_person: params[2] || '', mobile: params[3] || '', email: params[4] || '', gstin: params[5] || '', pan: params[6] || '', address: params[7] || '', credit_terms: params[8] || '30 Days', opening_balance: parseFloat(params[9]) || 0, status: 'ACTIVE', owner: params[10] || 'Admin', created_at: new Date().toISOString() };
        localStore.clients.push(newClient);
        return [{ affectedRows: 1, insertId: params[0] }, []];
    }
    if (s.includes('insert into vendors')) {
        const newVendor = { id: params[0], name: params[1], vendor_type: params[2] || 'General Vendor', contact_person: params[3] || '', mobile: params[4] || '', email: params[5] || '', gstin: params[6] || '', pan: params[7] || '', address: params[8] || '', bank_details: params[9] || '', credit_terms: params[10] || '15 Days', status: 'ACTIVE', remarks: params[11] || '', created_at: new Date().toISOString() };
        localStore.vendors.push(newVendor);
        return [{ affectedRows: 1, insertId: params[0] }, []];
    }
    if (s.includes('insert into services')) {
        const newSrv = { id: params[0], service_name: params[1], service_type: params[2] || 'General', default_gst_pct: parseFloat(params[3]) || 18, status: 'ACTIVE', created_at: new Date().toISOString() };
        localStore.services.push(newSrv);
        return [{ affectedRows: 1, insertId: params[0] }, []];
    }
    if (s.includes('insert into shipments')) {
        const shpId = params[0];
        const newShp = {
            id: shpId,
            date: params[1],
            client_id: params[2],
            company_name: params[3],
            line_name: params[4] || '',
            transport_name: params[5] || '',
            sb_be_no: params[6] || '',
            shipment_type: params[7] || 'EXPORT FCL',
            purchase_date: params[8] || params[1],
            purchase_amount: parseFloat(params[9]) || 0,
            purchase_status: 'UNPAID',
            purchase_items: params[10] || '[]',
            sale_amount: parseFloat(params[11]) || 0,
            received_amount: 0,
            remaining_balance: parseFloat(params[12]) || 0,
            sale_status: 'UNPAID',
            sale_items: params[13] || '[]',
            net_profit: parseFloat(params[14]) || 0,
            created_at: new Date().toISOString()
        };
        localStore.shipments = localStore.shipments.filter(shp => String(shp.id).toLowerCase().trim() !== String(shpId).toLowerCase().trim());
        localStore.shipments.unshift(newShp);
        return [{ affectedRows: 1, insertId: shpId }, []];
    }
    if (s.includes('insert into payment_transactions')) {
        const newTx = { id: localStore.payment_transactions.length + 1, shipment_id: params[0], payment_date: params[1], amount: parseFloat(params[2]) || 0, payment_mode: params[3], bank: params[4], utr: params[5], remarks: params[6], created_by: params[7], created_at: new Date().toISOString() };
        localStore.payment_transactions.push(newTx);
        return [{ affectedRows: 1, insertId: newTx.id }, []];
    }
    if (s.includes('insert into vendor_payments')) {
        const newVp = { id: localStore.vendor_payments.length + 1, shipment_id: params[0], vendor_id: params[1], vendor_name: params[2], bill_no: params[3], payment_date: params[4], amount: parseFloat(params[5]) || 0, payment_mode: params[6], bank: params[7], reference_no: params[8], remarks: params[9], created_by: params[10], created_at: new Date().toISOString() };
        localStore.vendor_payments.push(newVp);
        return [{ affectedRows: 1, insertId: newVp.id }, []];
    }

    // 3. UPDATE QUERIES
    if (s.includes('update shipments')) {
        const shpId = String(params[13] || params[params.length - 1]).toLowerCase().trim();
        const existing = localStore.shipments.find(shp => String(shp.id).toLowerCase().trim() === shpId);
        if (existing) {
            existing.date = params[0];
            existing.line_name = params[1] || '';
            existing.transport_name = params[2] || '';
            existing.sb_be_no = params[3] || '';
            existing.shipment_type = params[4] || 'EXPORT FCL';
            existing.purchase_date = params[5] || params[0];
            existing.purchase_amount = parseFloat(params[6]) || 0;
            existing.purchase_items = params[7] || '[]';
            existing.sale_amount = parseFloat(params[8]) || 0;
            existing.remaining_balance = parseFloat(params[9]) || 0;
            existing.sale_status = params[10] || 'UNPAID';
            existing.sale_items = params[11] || '[]';
            existing.net_profit = parseFloat(params[12]) || 0;
        }
        return [{ affectedRows: 1 }, []];
    }
    if (s.startsWith('update')) {
        return [{ affectedRows: 1 }, []];
    }

    // 4. SELECT QUERIES
    if (s.includes('select id from clients where id = ?') || s.includes('select * from clients where id = ?')) {
        const found = localStore.clients.filter(c => c.id === params[0]);
        return [found, []];
    }
    if (s.includes('select id from vendors where id = ?') || s.includes('select * from vendors where id = ?')) {
        const found = localStore.vendors.filter(v => v.id === params[0]);
        return [found, []];
    }
    if (s.includes('select id from shipments where id = ?') || s.includes('select * from shipments where id = ?')) {
        const found = localStore.shipments.filter(shp => shp.id === params[0]);
        return [found, []];
    }
    if (s.includes('from directors')) {
        if (params && params.length > 0 && typeof params[0] === 'string') {
            const searchName = params[0].toLowerCase().trim();
            const matched = localStore.directors.filter(d => 
                d.name.toLowerCase().includes(searchName) || searchName.includes(d.name.toLowerCase())
            );
            return [matched, []];
        }
        return [localStore.directors, []];
    }
    if (s.includes('from clients')) {
        return [localStore.clients, []];
    }
    if (s.includes('from vendors')) {
        return [localStore.vendors, []];
    }
    if (s.includes('from services')) {
        return [localStore.services, []];
    }
    if (s.includes('from shipments')) {
        return [localStore.shipments, []];
    }
    if (s.includes('from payment_transactions')) {
        return [localStore.payment_transactions, []];
    }
    if (s.includes('from vendor_payments')) {
        return [localStore.vendor_payments, []];
    }

    return [[], []];
}

module.exports = pool;
