/* ==========================================================================
   AKASHA LOGITRANS LLP - MYSQL DATABASE CONNECTION POOL CONFIG
   Hostinger Database Resolver & DDL Auto-Migration Engine
   ========================================================================== */

const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcryptjs');

try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (e) {}

// Connection Config Options
const host = process.env.DB_HOST || process.env.HOST || '127.0.0.1';
const port = parseInt(process.env.DB_PORT || '3306');
const password = process.env.DB_PASSWORD || process.env.PASSWORD || 'Alt@7776';
const database = process.env.DB_NAME || process.env.DATABASE || 'u614117022_u614117022_erp';
const user = process.env.DB_USER || process.env.USERNAME || 'u614117022_u614117022_erp';

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

let pool = mysql.createPool(dbConfig);

// Auto Verify Connection & Auto-Migrate Database Schema
(async () => {
    try {
        await pool.query('SELECT 1');
        console.log(`✅ [Hostinger MySQL Pool Connected] DB: ${dbConfig.database} @ ${host}:${port}`);
    } catch (err) {
        console.error('❌ [Hostinger MySQL Initial Connection Warning]:', err.message);
    }

    try {
        // 1. DIRECTORS TABLE
        await pool.query(`CREATE TABLE IF NOT EXISTS directors (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            email VARCHAR(150) NOT NULL UNIQUE,
            pin_hash VARCHAR(255) NOT NULL,
            role VARCHAR(100) DEFAULT 'Director',
            avatar VARCHAR(255),
            status VARCHAR(20) DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Seed Directors if not present
        const [dirRows] = await pool.query(`SELECT COUNT(*) as count FROM directors`);
        if (dirRows && dirRows[0].count == 0) {
            const hash7776 = await bcrypt.hash('7776', 10);
            const hash7717 = await bcrypt.hash('7717', 10);
            const hash8866 = await bcrypt.hash('8866', 10);

            await pool.query(`INSERT INTO directors (id, name, email, pin_hash, role, avatar) VALUES
                ('dir_1', 'Khushal Patel', 'khushal@akashalogitrans.com', ?, 'CEO & Founder', 'https://akashalogitrans.com/khushal.png'),
                ('dir_2', 'Dhruv Patel', 'dhruv@akashalogitrans.com', ?, 'Director - Rates & Procurement', 'https://akashalogitrans.com/dhruv_patel.png'),
                ('dir_3', 'Yagnik Patel', 'info@akashalogitrans.com', ?, 'Director - Finance & Audit', 'https://akashalogitrans.com/yagnik.jpeg')
            `, [hash7776, hash7717, hash8866]);
            console.log('✅ [Directors Seeded Successfully]');
        }

        // 2. CLIENTS TABLE
        await pool.query(`CREATE TABLE IF NOT EXISTS clients (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            owner VARCHAR(150) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        try { await pool.query(`ALTER TABLE clients ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`); } catch (e) {}

        // 3. SHIPMENTS TABLE
        await pool.query(`CREATE TABLE IF NOT EXISTS shipments (
            id VARCHAR(100) PRIMARY KEY,
            date DATE NOT NULL,
            client_id VARCHAR(50),
            company_name VARCHAR(200),
            line_name VARCHAR(150),
            transport_name VARCHAR(150),
            sb_be_no VARCHAR(100),
            shipment_type VARCHAR(50),
            purchase_date DATE,
            purchase_amount DECIMAL(14, 2) DEFAULT 0,
            purchase_status VARCHAR(30) DEFAULT 'Pending',
            purchase_items TEXT,
            payment_receive_date DATE,
            sale_amount DECIMAL(14, 2) DEFAULT 0,
            received_amount DECIMAL(14, 2) DEFAULT 0,
            remaining_balance DECIMAL(14, 2) DEFAULT 0,
            sale_status VARCHAR(30) DEFAULT 'Pending',
            sale_items TEXT,
            net_profit DECIMAL(14, 2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        try { await pool.query(`ALTER TABLE shipments ADD COLUMN remaining_balance DECIMAL(14, 2) DEFAULT 0`); } catch (e) {}

        // 4. PAYMENT TRANSACTIONS TABLE
        await pool.query(`CREATE TABLE IF NOT EXISTS payment_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            shipment_id VARCHAR(100) NOT NULL,
            payment_date DATE NOT NULL,
            amount DECIMAL(14, 2) NOT NULL,
            payment_mode VARCHAR(50) DEFAULT 'Bank Transfer',
            bank VARCHAR(100) DEFAULT 'HDFC Bank',
            utr VARCHAR(100),
            remarks TEXT,
            created_by VARCHAR(100) DEFAULT 'Director',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // 5. LOGIN AUDIT LOGS TABLE
        await pool.query(`CREATE TABLE IF NOT EXISTS login_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_name VARCHAR(100),
            ip VARCHAR(50),
            browser TEXT,
            status VARCHAR(50),
            login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // 6. ACTIVITY LOGS TABLE
        await pool.query(`CREATE TABLE IF NOT EXISTS activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_name VARCHAR(100),
            action VARCHAR(100),
            target_type VARCHAR(50),
            target_id VARCHAR(100),
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // 7. NOTIFICATIONS TABLE
        await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            message TEXT,
            type VARCHAR(30) DEFAULT 'info',
            is_read TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // 8. SETTINGS TABLE
        await pool.query(`CREATE TABLE IF NOT EXISTS settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            key_name VARCHAR(100) NOT NULL UNIQUE,
            value_name TEXT,
            description TEXT
        )`);

        console.log('✅ [Hostinger MySQL 8 Tables Auto-Migrated & Verified Active]');
    } catch (tblErr) {
        console.error('❌ [Table Init Error]:', tblErr.message);
    }
})();

module.exports = pool;
