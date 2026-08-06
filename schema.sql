-- ==========================================================================
-- AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP MYSQL SCHEMA FOR HOSTINGER
-- Target Database: Hostinger MySQL / phpMyAdmin
-- ==========================================================================

DROP TABLE IF EXISTS payment_transactions;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS login_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS directors;
DROP TABLE IF EXISTS users;

-- 1. DIRECTORS & USERS TABLE
CREATE TABLE directors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    pin_hash VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Director',
    avatar VARCHAR(255),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. CLIENT MASTER TABLE
CREATE TABLE clients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    owner VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- 4. PAYMENT TRANSACTIONS TABLE (MULTI-INSTALLMENT AUDIT TRAIL)
CREATE TABLE payment_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id VARCHAR(100) NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,
    payment_mode VARCHAR(50) DEFAULT 'Bank Transfer',
    bank VARCHAR(100) DEFAULT 'HDFC Bank',
    utr VARCHAR(100),
    remarks TEXT,
    created_by VARCHAR(100) DEFAULT 'Director',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
);

-- 5. LOGIN AUDIT LOGS TABLE
CREATE TABLE login_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(100),
    ip VARCHAR(50),
    browser TEXT,
    status VARCHAR(50),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. SYSTEM ACTIVITY LOGS TABLE
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(100),
    action VARCHAR(100),
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    type VARCHAR(30) DEFAULT 'info',
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. SYSTEM SETTINGS TABLE
CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL UNIQUE,
    value_name TEXT,
    description TEXT
);

-- Seed Directors (bcrypt hash for PINs: 7776 -> Khushal, 7717 -> Dhruv, 8866 -> Yagnik)
INSERT INTO directors (id, name, email, pin_hash, role, avatar) VALUES
('dir_1', 'Khushal Patel', 'khushal@akashalogitrans.com', '$2a$10$K7Z5E9yQn2mR8tU3vX1bO.6eB7z2y5e9yQn2mR8tU3vX1bO6eB7z2', 'CEO & Founder', 'https://akashalogitrans.com/khushal.png'),
('dir_2', 'Dhruv Patel', 'dhruv@akashalogitrans.com', '$2a$10$D8Z5E9yQn2mR8tU3vX1bO.6eB7z2y5e9yQn2mR8tU3vX1bO6eB7z2', 'Director - Rates & Procurement', 'https://akashalogitrans.com/dhruv_patel.png'),
('dir_3', 'Yagnik Patel', 'info@akashalogitrans.com', '$2a$10$Y9Z5E9yQn2mR8tU3vX1bO.6eB7z2y5e9yQn2mR8tU3vX1bO6eB7z2', 'Director - Finance & Audit', 'https://akashalogitrans.com/yagnik.jpeg');

-- Seed Sample Clients
INSERT INTO clients (id, name, owner) VALUES
('CLI-101', 'Morbi Ceramic Tiles Ltd', 'Khushal Patel'),
('CLI-102', 'Zecca Spices Exports', 'Dhruv Patel'),
('CLI-103', 'Infinity Hub Exim', 'Yagnik Patel');

-- Seed Sample Shipment Job
INSERT INTO shipments (
    id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type,
    purchase_date, purchase_amount, purchase_status, purchase_items,
    payment_receive_date, sale_amount, received_amount, remaining_balance, sale_status, sale_items, net_profit
) VALUES (
    'AKASHA/CLI-101/001', '2026-08-01', 'CLI-101', 'Morbi Ceramic Tiles Ltd', 'MAERSK LINE', 'VRL Logistics',
    'SB-8829102', 'Export FCL', '2026-08-01', 51000.00, 'Paid',
    '[{"vendor_name":"MAERSK LINE","expense_name":"Sea Freight Charge","amount":45000},{"vendor_name":"VRL Logistics","expense_name":"Trucking Transport","amount":6000}]',
    '2026-08-02', 54000.00, 54000.00, 0.00, 'Completed',
    '[{"item_name":"Container Freight Ocean Charges","qty":1,"rate":48000,"amount":48000},{"item_name":"CHA Documentation & Handling","qty":1,"rate":6000,"amount":6000}]',
    3000.00
);

-- Seed Sample Initial Payment Transaction
INSERT INTO payment_transactions (shipment_id, payment_date, amount, payment_mode, bank, utr, remarks, created_by) VALUES
('AKASHA/CLI-101/001', '2026-08-02', 54000.00, 'Bank Transfer', 'HDFC Bank', 'UTR998210398', 'Full payment received against invoice', 'Khushal Patel');
