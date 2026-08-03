-- ==========================================================================
   AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP SQL DATABASE SCHEMA
   Database: MySQL / PostgreSQL / SQLite3 Compatible
   ==========================================================================

-- 1. ADMIN USERS TABLE (Max 3 Admin Users)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    avatar VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. CLIENTS & VENDORS MASTER TABLE
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('Customer', 'Vendor')),
    gstin VARCHAR(20) NOT NULL,
    pan VARCHAR(20) NOT NULL,
    iec VARCHAR(30) DEFAULT '-',
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) DEFAULT 'India',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. SHIPMENTS MASTER TABLE
CREATE TABLE IF NOT EXISTS shipments (
    id VARCHAR(50) PRIMARY KEY,
    job_no VARCHAR(50) UNIQUE NOT NULL,
    mbl VARCHAR(100) NOT NULL,
    hbl VARCHAR(100) NOT NULL,
    customer_id VARCHAR(50) REFERENCES clients(id),
    carrier_line VARCHAR(100) NOT NULL,
    container_size VARCHAR(50) NOT NULL,
    pol VARCHAR(100) NOT NULL,
    pod VARCHAR(100) NOT NULL,
    status VARCHAR(30) CHECK (status IN ('Pending', 'In Transit', 'Completed', 'Canceled')),
    etd DATE,
    eta DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. CUSTOMER SALE INVOICES TABLE
CREATE TABLE IF NOT EXISTS sale_invoices (
    id VARCHAR(50) PRIMARY KEY,
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    customer_id VARCHAR(50) REFERENCES clients(id),
    shipment_id VARCHAR(50) REFERENCES shipments(id),
    invoice_date DATE NOT NULL,
    freight_amount DECIMAL(12, 2) DEFAULT 0,
    cha_amount DECIMAL(12, 2) DEFAULT 0,
    handling_amount DECIMAL(12, 2) DEFAULT 0,
    subtotal DECIMAL(12, 2) DEFAULT 0,
    gst_amount DECIMAL(12, 2) DEFAULT 0,
    grand_total DECIMAL(12, 2) DEFAULT 0,
    amount_received DECIMAL(12, 2) DEFAULT 0,
    amount_pending DECIMAL(12, 2) DEFAULT 0,
    payment_status VARCHAR(30) CHECK (payment_status IN ('Pending', 'Partially Paid', 'Completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. VENDOR PURCHASE VOUCHERS TABLE
CREATE TABLE IF NOT EXISTS purchase_vouchers (
    id VARCHAR(50) PRIMARY KEY,
    voucher_no VARCHAR(50) UNIQUE NOT NULL,
    vendor_id VARCHAR(50) REFERENCES clients(id),
    shipment_id VARCHAR(50) REFERENCES shipments(id),
    voucher_date DATE NOT NULL,
    taxable_value DECIMAL(12, 2) DEFAULT 0,
    cgst DECIMAL(12, 2) DEFAULT 0,
    sgst DECIMAL(12, 2) DEFAULT 0,
    igst DECIMAL(12, 2) DEFAULT 0,
    tds_amount DECIMAL(12, 2) DEFAULT 0,
    net_payable DECIMAL(12, 2) DEFAULT 0,
    payment_status VARCHAR(30) CHECK (payment_status IN ('Pending', 'Partially Paid', 'Paid')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. GENERAL ACCOUNTING LEDGER TABLE
CREATE TABLE IF NOT EXISTS general_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    particulars TEXT NOT NULL,
    debit DECIMAL(12, 2) DEFAULT 0,
    credit DECIMAL(12, 2) DEFAULT 0,
    running_balance DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. AUDIT TRAIL LOGS TABLE
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_name VARCHAR(100) NOT NULL,
    action_text TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================================
-- SEED ENTERPRISE DATA FOR AKASHA LOGITRANS
-- ==========================================================================

INSERT INTO users (id, name, email, password_hash, role, avatar) VALUES
('usr_1', 'Khushal Patel', 'khushal@akashalogitrans.com', '$2a$10$w8172615...hash', 'CEO & Founder', 'https://akashalogitrans.com/khushal.png'),
('usr_2', 'Dhruv Patel', 'dhruv@akashalogitrans.com', '$2a$10$81726152...hash', 'Director - Procurement', 'https://akashalogitrans.com/dhruv_patel.png'),
('usr_3', 'Yagnik Patel', 'info@akashalogitrans.com', '$2a$10$19283746...hash', 'Director - Finance & Audit', 'https://akashalogitrans.com/yagnik.jpeg');

INSERT INTO clients (id, name, type, gstin, pan, iec, city, state, country) VALUES
('CLI-101', 'Morbi Ceramic Tiles Exports Ltd', 'Customer', '24AAACM1234F1Z5', 'AAACM1234F', '0304958192', 'Morbi', 'Gujarat', 'India'),
('CLI-102', 'Gujarat Agro Spices Global Pvt Ltd', 'Customer', '24AACCG5678G1Z2', 'AACCG5678G', '0819284719', 'Rajkot', 'Gujarat', 'India'),
('CLI-103', 'Maersk Line Shipping India', 'Vendor', '27AABCM8819P1Z9', 'AABCM8819P', '-', 'Mumbai', 'Maharashtra', 'India'),
('CLI-104', 'MSC Mediterranean Shipping Co', 'Vendor', '27AAACM9928K1Z1', 'AAACM9928K', '-', 'Mumbai', 'Maharashtra', 'India');

INSERT INTO shipments (id, job_no, mbl, hbl, customer_id, carrier_line, container_size, pol, pod, status, etd, eta) VALUES
('SHP-001', 'AK-2026-0881', 'MAEU992817261', 'AKSH202601', 'CLI-101', 'MAERSK LINE', '2x40'' HC', 'Mundra Port', 'Jebel Ali (UAE)', 'In Transit', '2026-08-04', '2026-08-14'),
('SHP-002', 'AK-2026-0882', 'MEDU881920192', 'AKSH202602', 'CLI-102', 'MSC', '1x20'' Reefer', 'Kandla Port', 'Rotterdam (Netherlands)', 'Completed', '2026-07-15', '2026-08-01');
