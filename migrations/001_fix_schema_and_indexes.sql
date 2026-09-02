-- ==========================================================================
-- AKASHA LOGITRANS LLP - DATABASE MIGRATION 001
-- Safe, Non-destructive schema enhancements & Performance Indexes
-- ==========================================================================

-- 1. Ensure expenses has shipment_id column for Direct Shipment Expenses
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'expenses' 
      AND COLUMN_NAME = 'shipment_id'
);

SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE expenses ADD COLUMN shipment_id VARCHAR(100) NULL AFTER id, ADD CONSTRAINT fk_expenses_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL', 
    'SELECT "Column shipment_id already exists on expenses"'
);
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- 2. Performance Indexes (Safe creation)
-- Index on shipments (date, client_id)
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'shipments' 
      AND INDEX_NAME = 'idx_shipments_date_client'
);
SET @stmt = IF(@idx_exists = 0, 
    'CREATE INDEX idx_shipments_date_client ON shipments (date, client_id)', 
    'SELECT "Index idx_shipments_date_client already exists"'
);
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- Index on payment_transactions (shipment_id, payment_date)
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'payment_transactions' 
      AND INDEX_NAME = 'idx_payment_tx_shipment_date'
);
SET @stmt = IF(@idx_exists = 0, 
    'CREATE INDEX idx_payment_tx_shipment_date ON payment_transactions (shipment_id, payment_date)', 
    'SELECT "Index idx_payment_tx_shipment_date already exists"'
);
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- Index on vendor_payments (shipment_id, payment_date)
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'vendor_payments' 
      AND INDEX_NAME = 'idx_vendor_pay_shipment_date'
);
SET @stmt = IF(@idx_exists = 0, 
    'CREATE INDEX idx_vendor_pay_shipment_date ON vendor_payments (shipment_id, payment_date)', 
    'SELECT "Index idx_vendor_pay_shipment_date already exists"'
);
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- Index on expenses (expense_date, shipment_id)
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'expenses' 
      AND INDEX_NAME = 'idx_expenses_date_shipment'
);
SET @stmt = IF(@idx_exists = 0, 
    'CREATE INDEX idx_expenses_date_shipment ON expenses (expense_date, shipment_id)', 
    'SELECT "Index idx_expenses_date_shipment already exists"'
);
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;
