-- ==========================================================================
-- AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP MYSQL SCHEMA FOR HOSTINGER
-- Target Database: Hostinger MySQL / phpMyAdmin
-- ==========================================================================

DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS users;

-- 1. ADMIN USERS TABLE
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    role VARCHAR(100),
    avatar VARCHAR(255),
    code VARCHAR(50)
);

-- 2. CLIENT MASTER TABLE
CREATE TABLE clients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    owner VARCHAR(150) NOT NULL
);

-- 3. SHIPMENT MASTER & PROFIT LEDGER TABLE
CREATE TABLE shipments (
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
);

-- Seed Directors
INSERT INTO users (id, name, email, password_hash, role, avatar, code) VALUES
('usr_1', 'Khushal Patel', 'khushal@akashalogitrans.com', 'hash', 'CEO & Founder', 'https://akashalogitrans.com/khushal.png', '7776-KHUSHAL'),
('usr_2', 'Dhruv Patel', 'dhruv@akashalogitrans.com', 'hash', 'Director - Rates & Procurement', 'https://akashalogitrans.com/dhruv_patel.png', '7717-DHRUV'),
('usr_3', 'Yagnik Patel', 'info@akashalogitrans.com', 'hash', 'Director - Finance & Audit', 'https://akashalogitrans.com/yagnik.jpeg', '8866-YAGNIK');

-- Seed Sample Clients
INSERT INTO clients (id, name, owner) VALUES
('CLI-101', 'Morbi Ceramic Tiles Ltd', 'Khushal Patel'),
('CLI-102', 'Zecca Spices Exports', 'Dhruv Patel'),
('CLI-103', 'Maersk Shipping India', 'Yagnik Patel');

-- Seed Sample Shipment Job
INSERT INTO shipments (
    id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type,
    purchase_date, purchase_amount, purchase_status, purchase_items,
    payment_receive_date, sale_amount, received_amount, sale_status, sale_items, net_profit
) VALUES (
    'AKASHA/CLI-101/001', '2026-08-01', 'CLI-101', 'Morbi Ceramic Tiles Ltd', 'MAERSK LINE', 'VRL Logistics',
    'SB-8829102', 'Export FCL', '2026-08-01', 51000.00, 'Paid',
    '[{"vendor_name":"MAERSK LINE","expense_name":"Sea Freight Charge","amount":45000},{"vendor_name":"VRL Logistics","expense_name":"Trucking Transport","amount":6000}]',
    '2026-08-02', 54000.00, 54000.00, 'Completed',
    '[{"item_name":"Container Freight Ocean Charges","qty":1,"rate":48000,"amount":48000},{"item_name":"CHA Documentation & Handling","qty":1,"rate":6000,"amount":6000}]',
    3000.00
);
