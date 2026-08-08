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
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
};

console.log(`[MySQL Config] Connecting to Hostinger Database: ${dbConfig.database} @ ${host}:${port}`);

let mysqlPool = mysql.createPool(dbConfig);
let isDbConnected = false;

// Local Mock Store (Fallback when offline or running locally without MySQL daemon)
const hash077760 = bcrypt.hashSync('077760', 10);
const hash077170 = bcrypt.hashSync('077170', 10);
const hash088660 = bcrypt.hashSync('088660', 10);

const localStore = {
    directors: [
        { id: 'dir_1', name: 'Khushal Patel', email: 'khushal@akashalogitrans.com', pin_hash: hash077760, role: 'CEO & Founder', avatar: 'https://akashalogitrans.com/khushal.png', status: 'Active' },
        { id: 'dir_2', name: 'Dhruv Patel', email: 'dhruv@akashalogitrans.com', pin_hash: hash077170, role: 'Director - Rates & Procurement', avatar: 'https://akashalogitrans.com/dhruv_patel.png', status: 'Active' },
        { id: 'dir_3', name: 'Yagnik Patel', email: 'info@akashalogitrans.com', pin_hash: hash088660, role: 'Director - Finance & Audit', avatar: 'https://akashalogitrans.com/yagnik.jpeg', status: 'Active' }
    ],
    clients: [
        { id: 'CLI-101', name: 'Morbi Ceramic Tiles Ltd', contact_person: 'Khushal Patel', mobile: '9876543210', email: 'info@morbiceramics.com', gstin: '24AAACM1234F1Z1', pan: 'AAACM1234F', address: '8-A National Highway, Morbi, Gujarat', credit_terms: '30 Days', opening_balance: 0, status: 'ACTIVE', owner: 'Khushal Patel', created_at: new Date().toISOString() },
        { id: 'CLI-102', name: 'Zecca Spices Exports', contact_person: 'Dhruv Patel', mobile: '9898989898', email: 'exports@zecca.com', gstin: '24BBBCZ5678G1Z2', pan: 'BBBCZ5678G', address: 'Unjha Ganj Bazar, Gujarat', credit_terms: '15 Days', opening_balance: 0, status: 'ACTIVE', owner: 'Dhruv Patel', created_at: new Date().toISOString() },
        { id: 'CLI-103', name: 'Infinity Hub Exim', contact_person: 'Yagnik Patel', mobile: '9797979797', email: 'contact@infinityhub.com', gstin: '24CCCII9012H1Z3', pan: 'CCCII9012H', address: 'Ring Road, Surat, Gujarat', credit_terms: '30 Days', opening_balance: 0, status: 'ACTIVE', owner: 'Yagnik Patel', created_at: new Date().toISOString() }
    ],
    vendors: [
        { id: 'VND-001', name: 'MAERSK LINE', vendor_type: 'Shipping Line', contact_person: 'Rajesh Kumar', mobile: '9825001122', email: 'support@maersk.com', gstin: '24AAACM9999M1Z9', address: 'Mundra Port Office, Gujarat', bank_details: 'HDFC Bank - A/C 502000112233 - HDFC0000123', credit_terms: '15 Days', status: 'ACTIVE', created_at: new Date().toISOString() },
        { id: 'VND-002', name: 'VRL Logistics Ltd', vendor_type: 'Transporter', contact_person: 'Suresh Verma', mobile: '9825112233', email: 'ops@vrllogistics.com', gstin: '24AAACV8888V1Z8', address: 'Gandhidham Transporter Hub, Gujarat', bank_details: 'ICICI Bank - A/C 001105001234 - ICIC0000011', credit_terms: '7 Days', status: 'ACTIVE', created_at: new Date().toISOString() },
        { id: 'VND-003', name: 'ABC Documentation & CHA Services', vendor_type: 'CHA', contact_person: 'Amit Shah', mobile: '9825223344', email: 'cha@abcservices.com', gstin: '24AAACA7777A1Z7', address: 'Kandla Customs Enclave, Gujarat', bank_details: 'SBI - A/C 30112233445 - SBIN0001234', credit_terms: '30 Days', status: 'ACTIVE', created_at: new Date().toISOString() }
    ],
    services: [
        { id: 'SRV-001', service_name: 'Ocean Freight', service_type: 'Freight Charges', default_gst_pct: 18, status: 'ACTIVE' },
        { id: 'SRV-002', service_name: 'Air Freight', service_type: 'Freight Charges', default_gst_pct: 18, status: 'ACTIVE' },
        { id: 'SRV-003', service_name: 'Transportation', service_type: 'Logistics', default_gst_pct: 12, status: 'ACTIVE' },
        { id: 'SRV-004', service_name: 'Documentation', service_type: 'CHA Charges', default_gst_pct: 18, status: 'ACTIVE' },
        { id: 'SRV-005', service_name: 'THC (Terminal Handling)', service_type: 'Port Charges', default_gst_pct: 18, status: 'ACTIVE' },
        { id: 'SRV-006', service_name: 'Port Charges', service_type: 'Port Charges', default_gst_pct: 18, status: 'ACTIVE' },
        { id: 'SRV-007', service_name: 'Custom Clearance', service_type: 'CHA Charges', default_gst_pct: 18, status: 'ACTIVE' },
        { id: 'SRV-008', service_name: 'Handling Charges', service_type: 'CHA Charges', default_gst_pct: 18, status: 'ACTIVE' },
        { id: 'SRV-009', service_name: 'Certificate of Origin', service_type: 'Documentation', default_gst_pct: 18, status: 'ACTIVE' },
        { id: 'SRV-010', service_name: 'Local Charges', service_type: 'Local Charges', default_gst_pct: 18, status: 'ACTIVE' },
        { id: 'SRV-011', service_name: 'Other Charges', service_type: 'Miscellaneous', default_gst_pct: 18, status: 'ACTIVE' }
    ],
    shipments: [
        {
            id: 'AKASHA/CLI-101/001',
            date: '2026-08-01',
            client_id: 'CLI-101',
            company_name: 'Morbi Ceramic Tiles Ltd',
            line_name: 'MAERSK LINE',
            transport_name: 'VRL Logistics',
            sb_be_no: 'SB-8829102',
            shipment_type: 'Export FCL',
            purchase_date: '2026-08-01',
            purchase_amount: 51000.00,
            purchase_status: 'PAID',
            purchase_items: '[{"vendor_name":"MAERSK LINE","expense_name":"Ocean Freight","amount":30000},{"vendor_name":"VRL Logistics Ltd","expense_name":"Transportation","amount":12000},{"vendor_name":"ABC Documentation & CHA Services","expense_name":"Documentation","amount":9000}]',
            payment_receive_date: '2026-08-02',
            sale_amount: 54000.00,
            received_amount: 54000.00,
            remaining_balance: 0.00,
            sale_status: 'PAID',
            sale_items: '[{"item_name":"Ocean Freight","qty":1,"rate":40000,"amount":40000},{"item_name":"Documentation","qty":1,"rate":5000,"amount":5000},{"item_name":"Transportation","qty":1,"rate":9000,"amount":9000}]',
            net_profit: 3000.00,
            created_at: new Date().toISOString()
        }
    ],
    payment_transactions: [],
    vendor_payments: [],
    login_logs: [],
    activity_logs: [],
    settings: []
};

// Safe Proxy Object wrapping pool.execute and pool.query
const pool = {
    async query(sql, params = []) {
        return this.execute(sql, params);
    },
    async execute(sql, params = []) {
        try {
            return await mysqlPool.execute(sql, params);
        } catch (err) {
            console.error('[MySQL Query Error]:', err.message, '| Query:', sql);
            if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'PROTOCOL_CONNECTION_LOST') {
                isDbConnected = false;
                if (process.env.NODE_ENV !== 'production') {
                    return handleLocalFallbackQuery(sql, params);
                }
            }
            throw err;
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
            pin_hash VARCHAR(255) NOT NULL, role VARCHAR(100) DEFAULT 'Director', avatar VARCHAR(255), status VARCHAR(20) DEFAULT 'Active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        const [dirRows] = await mysqlPool.query(`SELECT COUNT(*) as count FROM directors`);
        if (dirRows && dirRows[0].count == 0) {
            const h077760 = await bcrypt.hash('077760', 10);
            const h077170 = await bcrypt.hash('077170', 10);
            const h088660 = await bcrypt.hash('088660', 10);

            await mysqlPool.query(`INSERT INTO directors (id, name, email, pin_hash, role, avatar) VALUES
                ('dir_1', 'Khushal Patel', 'khushal@akashalogitrans.com', ?, 'CEO & Founder', 'https://akashalogitrans.com/khushal.png'),
                ('dir_2', 'Dhruv Patel', 'dhruv@akashalogitrans.com', ?, 'Director - Rates & Procurement', 'https://akashalogitrans.com/dhruv_patel.png'),
                ('dir_3', 'Yagnik Patel', 'info@akashalogitrans.com', ?, 'Director - Finance & Audit', 'https://akashalogitrans.com/yagnik.jpeg')
            `, [h077760, h077170, h088660]);
        }

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

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS login_logs (
            id INT AUTO_INCREMENT PRIMARY KEY, user_name VARCHAR(100), ip VARCHAR(50), browser TEXT, status VARCHAR(50), login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await mysqlPool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY, user_name VARCHAR(100), action VARCHAR(100), target_type VARCHAR(50), target_id VARCHAR(100), details TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

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
