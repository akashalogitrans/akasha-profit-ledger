/* ==========================================================================
   AKASHA LOGITRANS LLP - MYSQL DATABASE CONNECTION POOL CONFIG
   Smart Dual-Name Hostinger Database Resolver (u614117022_u614117022_erp)
   ========================================================================== */

const mysql = require('mysql2/promise');
const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (e) {}

// Always connect to 127.0.0.1 locally on Hostinger
const host = '127.0.0.1';
const port = parseInt(process.env.DB_PORT || '3306');
const password = process.env.PASSWORD || process.env.DB_PASSWORD || 'Alt@7776';

// Prioritize full phpMyAdmin Database Name: u614117022_u614117022_erp
const primaryDb = 'u614117022_u614117022_erp';
const primaryUser = 'u614117022_u614117022_erp';

const dbConfig = {
    host,
    port,
    user: process.env.USERNAME || process.env.DB_USER || primaryUser,
    password,
    database: process.env.DATABASE || process.env.DB_NAME || primaryDb,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
};

console.log(`[MySQL Config] Connecting to Hostinger Database: ${dbConfig.database} @ ${host}:${port}`);

let pool = mysql.createPool(dbConfig);

// Auto Verify Connection & Fallback to Full phpMyAdmin DB Name if Short Name Fails
(async () => {
    try {
        await pool.query('SELECT 1');
        console.log(`✅ [Hostinger MySQL Pool Connected] DB: ${dbConfig.database} @ 127.0.0.1`);
    } catch (err) {
        console.warn(`[MySQL Initial Connection Failed]: ${err.message}. Retrying with primary phpMyAdmin DB: ${primaryDb}...`);
        
        // Fallback to exact phpMyAdmin credentials
        dbConfig.database = primaryDb;
        dbConfig.user = primaryUser;
        pool = mysql.createPool(dbConfig);

        try {
            await pool.query('SELECT 1');
            console.log(`✅ [Hostinger MySQL Pool Fallback Connected] DB: ${primaryDb} @ 127.0.0.1`);
        } catch (e) {
            console.error('❌ [Hostinger MySQL Connection Failed]:', e.message);
        }
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
