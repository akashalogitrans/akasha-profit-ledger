-- =============================================================================
-- AKASHA LOGITRANS ERP - MIGRATION 002: VENDOR PERFORMANCE INDEXES & INTEGRITY
-- =============================================================================

-- 1. Index on vendor_payments(vendor_id, shipment_id) for rapid vendor ledger lookup
CREATE INDEX IF NOT EXISTS idx_vp_vendor_shipment ON vendor_payments (vendor_id, shipment_id);

-- 2. Index on vendor_payments(payment_date) for date filtering
CREATE INDEX IF NOT EXISTS idx_vp_payment_date ON vendor_payments (payment_date);

-- 3. Index on vendors(name) for case-insensitive lookup
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors (name);
