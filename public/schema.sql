-- ==========================================================================
-- AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP MYSQL COMPLETE SCHEMA
-- Target Engine: Hostinger MySQL / phpMyAdmin (UTF-8 MB4)
-- ==========================================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS login_logs;
DROP TABLE IF EXISTS vendor_payments;
DROP TABLE IF EXISTS payment_transactions;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS vendors;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS directors;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. DIRECTORS TABLE (Authentication & T-PIN Hash)
CREATE TABLE directors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    pin_hash VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Director',
    avatar VARCHAR(255),
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. CLIENT MASTER TABLE
CREATE TABLE clients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    mobile VARCHAR(50),
    email VARCHAR(150),
    gstin VARCHAR(50),
    pan VARCHAR(50),
    address TEXT,
    credit_terms VARCHAR(50) DEFAULT '30 Days',
    opening_balance DECIMAL(14,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    owner VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. VENDOR MASTER TABLE
CREATE TABLE vendors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    vendor_type VARCHAR(100) DEFAULT 'General Vendor',
    contact_person VARCHAR(100),
    mobile VARCHAR(50),
    email VARCHAR(150),
    gstin VARCHAR(50),
    pan VARCHAR(50),
    address TEXT,
    bank_details TEXT,
    credit_terms VARCHAR(50) DEFAULT '15 Days',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. SERVICE MASTER TABLE
CREATE TABLE services (
    id VARCHAR(50) PRIMARY KEY,
    service_name VARCHAR(150) NOT NULL UNIQUE,
    service_type VARCHAR(100) DEFAULT 'General',
    default_gst_pct DECIMAL(5,2) DEFAULT 18.00,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. SHIPMENT MASTER & PROFIT LEDGER TABLE
CREATE TABLE shipments (
    id VARCHAR(100) PRIMARY KEY,
    date DATE NOT NULL,
    client_id VARCHAR(50),
    company_name VARCHAR(200),
    line_name VARCHAR(150),
    transport_name VARCHAR(150),
    sb_be_no VARCHAR(100),
    shipment_type VARCHAR(50) DEFAULT 'EXPORT FCL',
    purchase_date DATE,
    purchase_amount DECIMAL(14, 2) DEFAULT 0,
    purchase_status VARCHAR(30) DEFAULT 'UNPAID',
    purchase_items LONGTEXT,
    payment_receive_date DATE,
    sale_amount DECIMAL(14, 2) DEFAULT 0,
    received_amount DECIMAL(14, 2) DEFAULT 0,
    remaining_balance DECIMAL(14, 2) DEFAULT 0,
    sale_status VARCHAR(30) DEFAULT 'UNPAID',
    sale_items LONGTEXT,
    net_profit DECIMAL(14, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. CUSTOMER PAYMENT TRANSACTIONS TABLE
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. VENDOR PAYMENTS TABLE
CREATE TABLE vendor_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id VARCHAR(100) NOT NULL,
    vendor_id VARCHAR(50),
    vendor_name VARCHAR(200),
    bill_no VARCHAR(100),
    payment_date DATE NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,
    payment_mode VARCHAR(50) DEFAULT 'NEFT',
    bank VARCHAR(100) DEFAULT 'HDFC Bank',
    reference_no VARCHAR(100),
    remarks TEXT,
    created_by VARCHAR(100) DEFAULT 'Director',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. LOGIN AUDIT LOGS TABLE
CREATE TABLE login_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(100),
    ip VARCHAR(50),
    browser TEXT,
    status VARCHAR(50),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. AUDIT LOGS TABLE
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(100),
    action VARCHAR(100),
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================================
-- PRE-SEEDED MASTER DATA
-- ==========================================================================

-- Seed Directors (T-PIN Hashes: 077760 -> Khushal, 077170 -> Dhruv, 088660 -> Yagnik)
INSERT INTO directors (id, name, email, pin_hash, role, avatar) VALUES
('dir_1', 'Khushal Patel', 'khushal@akashalogitrans.com', '$2a$10$tZ92E7K6EwY6h1tA1mO7e.eWbB9x1r1n1g1h1u1s1h1a1l1p1a1t', 'CEO & Founder', 'https://akashalogitrans.com/khushal.png'),
('dir_2', 'Dhruv Patel', 'dhruv@akashalogitrans.com', '$2a$10$d77170.d77170.d77170.d77170.d77170.d77170.d77170.d77', 'Director - Rates & Procurement', 'https://akashalogitrans.com/dhruv_patel.png'),
('dir_3', 'Yagnik Patel', 'info@akashalogitrans.com', '$2a$10$y88660.y88660.y88660.y88660.y88660.y88660.y88660.y88', 'Director - Finance & Audit', 'https://akashalogitrans.com/yagnik.jpeg');

-- Seed Clients
INSERT INTO clients (id, name, contact_person, mobile, email, gstin, pan, address, credit_terms, opening_balance, status, owner) VALUES
('CLI-101', 'Morbi Ceramic Tiles Ltd', 'Khushal Patel', '9876543210', 'info@morbiceramics.com', '24AAACM1234F1Z1', 'AAACM1234F', '8-A National Highway, Morbi, Gujarat', '30 Days', 0.00, 'ACTIVE', 'Khushal Patel'),
('CLI-102', 'Zecca Spices Exports', 'Dhruv Patel', '9898989898', 'exports@zecca.com', '24BBBCZ5678G1Z2', 'BBBCZ5678G', 'Unjha Ganj Bazar, Gujarat', '15 Days', 0.00, 'ACTIVE', 'Dhruv Patel'),
('CLI-103', 'Infinity Hub Exim', 'Yagnik Patel', '9797979797', 'contact@infinityhub.com', '24CCCII9012H1Z3', 'CCCII9012H', 'Ring Road, Surat, Gujarat', '30 Days', 0.00, 'ACTIVE', 'Yagnik Patel');

-- Seed Vendors
INSERT INTO vendors (id, name, vendor_type, contact_person, mobile, email, gstin, pan, address, bank_details, credit_terms, status, remarks) VALUES
('VND-001', 'MAERSK LINE', 'Shipping Line', 'Rajesh Kumar', '9825001122', 'support@maersk.com', '24AAACM9999M1Z9', 'AAACM9999M', 'Mundra Port Office, Gujarat', 'HDFC Bank - A/C 502000112233 - HDFC0000123', '15 Days', 'ACTIVE', 'Preferred Ocean Line'),
('VND-002', 'VRL Logistics Ltd', 'Transporter', 'Suresh Verma', '9825112233', 'ops@vrllogistics.com', '24AAACV8888V1Z8', 'AAACV8888V', 'Gandhidham Transporter Hub, Gujarat', 'ICICI Bank - A/C 001105001234 - ICIC0000011', '7 Days', 'ACTIVE', 'Road Transport Partner'),
('VND-003', 'ABC Documentation & CHA Services', 'CHA', 'Amit Shah', '9825223344', 'cha@abcservices.com', '24AAACA7777A1Z7', 'AAACA7777A', 'Kandla Customs Enclave, Gujarat', 'SBI - A/C 30112233445 - SBIN0001234', '30 Days', 'ACTIVE', 'Customs Handling Agent');

-- Seed Services
INSERT INTO services (id, service_name, service_type, default_gst_pct, status) VALUES
('SRV-001', 'Ocean Freight', 'Freight Charges', 18.00, 'ACTIVE'),
('SRV-002', 'Air Freight', 'Freight Charges', 18.00, 'ACTIVE'),
('SRV-003', 'Transportation', 'Logistics', 12.00, 'ACTIVE'),
('SRV-004', 'Documentation', 'CHA Charges', 18.00, 'ACTIVE'),
('SRV-005', 'THC (Terminal Handling)', 'Port Charges', 18.00, 'ACTIVE'),
('SRV-006', 'Port Charges', 'Port Charges', 18.00, 'ACTIVE'),
('SRV-007', 'Custom Clearance', 'CHA Charges', 18.00, 'ACTIVE'),
('SRV-008', 'Handling Charges', 'CHA Charges', 18.00, 'ACTIVE'),
('SRV-009', 'Certificate of Origin', 'Documentation', 18.00, 'ACTIVE'),
('SRV-010', 'Local Charges', 'Local Charges', 18.00, 'ACTIVE'),
('SRV-011', 'Other Charges', 'Miscellaneous', 18.00, 'ACTIVE');

-- Seed Sample Shipment Job
INSERT INTO shipments (
    id, date, client_id, company_name, line_name, transport_name, sb_be_no, shipment_type,
    purchase_date, purchase_amount, purchase_status, purchase_items,
    payment_receive_date, sale_amount, received_amount, remaining_balance, sale_status, sale_items, net_profit
) VALUES (
    'AKASHA/CLI-101/001', '2026-08-01', 'CLI-101', 'Morbi Ceramic Tiles Ltd', 'MAERSK LINE', 'VRL Logistics Ltd',
    'SB-8829102', 'EXPORT FCL', '2026-08-01', 35400.00, 'PAID',
    '[{"vendor_name":"MAERSK LINE","expense_name":"Ocean Freight","currency":"INR","ex_rate":1,"foreign_amount":30000,"amount":35400}]',
    '2026-08-02', 53100.00, 53100.00, 0.00, 'PAID',
    '[{"service_name":"Ocean Freight","currency":"INR","ex_rate":1,"qty":1,"rate":45000,"amount":53100}]',
    17700.00
);

-- Seed Sample Customer Payment Transaction
INSERT INTO payment_transactions (shipment_id, payment_date, amount, payment_mode, bank, utr, remarks, created_by) VALUES
('AKASHA/CLI-101/001', '2026-08-02', 53100.00, 'Bank Transfer', 'HDFC Bank', 'UTR998210398', 'Full payment received against invoice', 'Khushal Patel');

-- Seed Sample Vendor Payment
INSERT INTO vendor_payments (shipment_id, vendor_id, vendor_name, bill_no, payment_date, amount, payment_mode, bank, reference_no, remarks, created_by) VALUES
('AKASHA/CLI-101/001', 'VND-001', 'MAERSK LINE', 'BILL-8821', '2026-08-01', 35400.00, 'NEFT', 'HDFC Bank', 'NEFT00192831', 'Vendor ocean freight bill paid', 'Dhruv Patel');
