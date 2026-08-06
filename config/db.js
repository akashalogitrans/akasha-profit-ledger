/* ==========================================================================
   AKASHA LOGITRANS LLP - MYSQL DATABASE CONNECTION POOL CONFIG
   Hostinger Database Resolver
   ========================================================================== */

const mysql = require('mysql2/promise');
const path = require('path');
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

// Auto Verify Connection & Ensure Tables Exist
(async () => {
    try {
        await pool.query('SELECT 1');
        console.log(`✅ [Hostinger MySQL Pool Connected] DB: ${dbConfig.database} @ ${host}:${port}`);
    } catch (err) {
        console.error('❌ [Hostinger MySQL Initial Connection Warning]:', err.message);
    }

    // Ensure Tables Exist
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(150) UNIQUE NOT NULL,
            password_hash VARCHAR(255),
            role VARCHAR(100),
            avatar VARCHAR(255),
            code VARCHAR(50)
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS clients (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            owner VARCHAR(150) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

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

        console.log('✅ [Hostinger MySQL Tables Verified Active]');
    } catch (tblErr) {
        console.error('❌ [Table Init Error]:', tblErr.message);
    }
})();

module.exports = pool;
