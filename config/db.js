/* ==========================================================================
   AKASHA LOGITRANS LLP - MYSQL DATABASE CONNECTION POOL CONFIG
   Supports Hostinger Environment Variables (HOST, DATABASE, USERNAME, PASSWORD)
   ========================================================================== */

const mysql = require('mysql2/promise');
try { require('dotenv').config(); } catch (e) {}

const host = process.env.HOST || process.env.DB_HOST || '127.0.0.1';
const user = process.env.USERNAME || process.env.DB_USER || process.env.USER || 'u614117022_u614117022_erp';
const password = process.env.PASSWORD || process.env.DB_PASSWORD || 'Alt@7776';
const database = process.env.DATABASE || process.env.DB_NAME || 'u614117022_u614117022_erp';
const port = parseInt(process.env.DB_PORT || '3306');

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

console.log(`[MySQL Config] Connecting to Hostinger Database: ${database} @ ${host}:${port} as User: ${user}`);

const pool = mysql.createPool(dbConfig);

// Auto Verify Connection & Initialize Tables
(async () => {
    try {
        const [res] = await pool.query('SELECT 1');
        console.log(`✅ [MySQL Pool Connected Successfully] Database: ${database} @ ${host}`);

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

        console.log('✅ [Hostinger MySQL Tables Ready]');
    } catch (err) {
        console.error('❌ [MySQL Pool Connection Error]:', err.message);
    }
})();

module.exports = pool;
