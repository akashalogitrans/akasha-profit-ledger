/* ==========================================================================
   AKASHA LOGITRANS LLP - SAFE MIGRATION RUNNER
   Applies schema updates non-destructively to the active database.
   ========================================================================== */

const pool = require('../config/db');

async function runMigration() {
    console.log('--- Starting Safe Schema Migration ---');
    const conn = await pool.getConnection();
    try {
        // 1. Check & Add shipment_id column to expenses
        const [colRows] = await conn.execute(`
            SELECT COUNT(*) AS cnt 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'expenses' 
              AND COLUMN_NAME = 'shipment_id'
        `);
        if (colRows[0].cnt === 0) {
            console.log('Adding shipment_id column to expenses table...');
            await conn.execute(`ALTER TABLE expenses ADD COLUMN shipment_id VARCHAR(100) NULL AFTER id`);
            try {
                await conn.execute(`ALTER TABLE expenses ADD CONSTRAINT fk_expenses_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL`);
            } catch (e) {
                console.log('Note: FK constraint could not be added (may already exist or index type mismatch):', e.message);
            }
        } else {
            console.log('Column shipment_id already exists on expenses.');
        }

        // 2. Safe Index Creation Helper
        async function safeAddIndex(table, indexName, columns) {
            const [idxRows] = await conn.execute(`
                SELECT COUNT(*) AS cnt 
                FROM information_schema.STATISTICS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = ? 
                  AND INDEX_NAME = ?
            `, [table, indexName]);
            if (idxRows[0].cnt === 0) {
                console.log(`Creating index ${indexName} on ${table}(${columns})...`);
                await conn.execute(`CREATE INDEX ${indexName} ON ${table} (${columns})`);
            } else {
                console.log(`Index ${indexName} already exists on ${table}.`);
            }
        }

        await safeAddIndex('shipments', 'idx_shipments_date_client', 'date, client_id');
        await safeAddIndex('payment_transactions', 'idx_payment_tx_shipment_date', 'shipment_id, payment_date');
        await safeAddIndex('vendor_payments', 'idx_vendor_pay_shipment_date', 'shipment_id, payment_date');
        await safeAddIndex('vendor_payments', 'idx_vp_vendor_shipment', 'vendor_id, shipment_id');
        await safeAddIndex('vendor_payments', 'idx_vp_payment_date', 'payment_date');
        await safeAddIndex('vendors', 'idx_vendors_name', 'name');
        await safeAddIndex('expenses', 'idx_expenses_date_shipment', 'expense_date, shipment_id');

        console.log('--- Safe Migration Completed Successfully ---');
    } catch (err) {
        console.error('Migration Error:', err.message);
    } finally {
        conn.release();
        process.exit(0);
    }
}

runMigration();
