/* ==========================================================================
   AKASHA LOGITRANS LLP - FINANCIAL DATA RECONCILIATION & AUDIT TOOL
   Dry Run & Apply Modes for Safe Ledger Verification & Integrity Audit
   ========================================================================== */

const pool = require('../config/db');
const { 
    safeNumber, 
    calculatePurchaseItems, 
    calculateSaleItems, 
    calculateNetProfit, 
    calculateMarginPercentage 
} = require('../utils/financialUtils');
const { normalizeDateOnly } = require('../utils/dateUtils');

async function runReconciliation() {
    const args = process.argv.slice(2);
    const isApply = args.includes('--apply');
    const mode = isApply ? 'APPLY (Modifying Database)' : 'DRY RUN (Read Only)';

    console.log(`====================================================================`);
    console.log(`AKASHA PROFIT LEDGER - DATA INTEGRITY AUDIT & RECONCILIATION`);
    console.log(`Mode: ${mode}`);
    console.log(`====================================================================\n`);

    try {
        const [shipments] = await pool.execute(`SELECT * FROM shipments ORDER BY date DESC, id DESC`);
        console.log(`Found ${shipments.length} total shipments in database.\n`);

        let discrepanciesFound = 0;
        let correctedCount = 0;

        for (const s of shipments) {
            const shpId = s.id;
            const curSale = safeNumber(s.sale_amount, 0);
            const curPur = safeNumber(s.purchase_amount, 0);
            const curNet = safeNumber(s.net_profit, 0);
            const curRec = safeNumber(s.received_amount, 0);
            const curBal = safeNumber(s.remaining_balance, 0);
            const curSaleStatus = s.sale_status || 'UNPAID';
            const curPurStatus = s.purchase_status || 'UNPAID';

            // 1. Recalculate Purchase from items
            const purCalc = calculatePurchaseItems(s.purchase_items);
            const expectedPur = purCalc.totalPurchase;

            // 2. Recalculate Sales from items
            const saleCalc = calculateSaleItems(s.sale_items);
            const expectedSale = saleCalc.totalSale;

            // 3. Recalculate Actual Direct Expenses from expenses table
            const [expRows] = await pool.execute(
                `SELECT COALESCE(SUM(amount), 0) AS direct_exp FROM expenses WHERE shipment_id = ?`,
                [shpId]
            );
            const directExp = expRows ? safeNumber(expRows[0].direct_exp, 0) : 0;

            // 4. Recalculate Net Profit
            // Note: If line items were empty, fallback to recorded values
            const finalSale = expectedSale > 0 ? expectedSale : curSale;
            const finalPur = expectedPur > 0 ? expectedPur : curPur;
            const expectedNetProfit = calculateNetProfit(finalSale, finalPur, directExp);

            // 5. Recalculate Customer Receipts
            const [ptRows] = await pool.execute(
                `SELECT COALESCE(SUM(amount), 0) AS total_rec FROM payment_transactions WHERE shipment_id = ?`,
                [shpId]
            );
            const actualRec = ptRows ? safeNumber(ptRows[0].total_rec, 0) : 0;
            const cappedRec = Math.min(finalSale, Math.max(0, actualRec));
            const expectedBal = Math.max(0, finalSale - cappedRec);
            const expectedSaleStatus = cappedRec >= finalSale && finalSale > 0 ? 'PAID' : (cappedRec > 0 ? 'PARTIAL' : 'UNPAID');

            // 6. Recalculate Vendor Payments
            const [vpRows] = await pool.execute(
                `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM vendor_payments WHERE shipment_id = ?`,
                [shpId]
            );
            const actualVp = vpRows ? safeNumber(vpRows[0].total_paid, 0) : 0;
            const cappedVp = Math.min(finalPur, Math.max(0, actualVp));
            const expectedPurStatus = cappedVp >= finalPur && finalPur > 0 ? 'PAID' : (cappedVp > 0 ? 'PARTIAL' : 'UNPAID');

            // Detect any mismatch
            const hasSaleMismatch = Math.abs(curSale - finalSale) > 0.01;
            const hasPurMismatch = Math.abs(curPur - finalPur) > 0.01;
            const hasNetMismatch = Math.abs(curNet - expectedNetProfit) > 0.01;
            const hasRecMismatch = Math.abs(curRec - cappedRec) > 0.01;
            const hasBalMismatch = Math.abs(curBal - expectedBal) > 0.01;
            const hasStatusMismatch = curSaleStatus !== expectedSaleStatus || curPurStatus !== expectedPurStatus;

            const isDiscrepancy = hasSaleMismatch || hasPurMismatch || hasNetMismatch || hasRecMismatch || hasBalMismatch || hasStatusMismatch;

            if (isDiscrepancy) {
                discrepanciesFound++;
                console.log(`⚠️  [Discrepancy Detected] Shipment: ${shpId} (${s.company_name})`);
                if (hasSaleMismatch) console.log(`   - Sale Amount: DB = ₹${curSale} | Expected = ₹${finalSale}`);
                if (hasPurMismatch) console.log(`   - Purchase Amount: DB = ₹${curPur} | Expected = ₹${finalPur}`);
                if (hasNetMismatch) console.log(`   - Net Profit: DB = ₹${curNet} | Expected = ₹${expectedNetProfit}`);
                if (hasRecMismatch) console.log(`   - Received Amount: DB = ₹${curRec} | Expected = ₹${cappedRec}`);
                if (hasBalMismatch) console.log(`   - Balance Amount: DB = ₹${curBal} | Expected = ₹${expectedBal}`);
                if (hasStatusMismatch) console.log(`   - Status: Sale DB (${curSaleStatus} -> ${expectedSaleStatus}), Purchase DB (${curPurStatus} -> ${expectedPurStatus})`);

                if (isApply) {
                    await pool.execute(
                        `UPDATE shipments SET 
                            sale_amount = ?, purchase_amount = ?, net_profit = ?,
                            received_amount = ?, remaining_balance = ?, sale_status = ?, purchase_status = ?
                         WHERE id = ?`,
                        [finalSale, finalPur, expectedNetProfit, cappedRec, expectedBal, expectedSaleStatus, expectedPurStatus, shpId]
                    );
                    correctedCount++;
                    console.log(`   ✅ Corrected in database.`);
                }
                console.log('');
            }
        }

        console.log(`--------------------------------------------------------------------`);
        console.log(`Audit Summary:`);
        console.log(`Total Shipments Checked: ${shipments.length}`);
        console.log(`Discrepancies Detected:  ${discrepanciesFound}`);
        if (isApply) {
            console.log(`Records Corrected:       ${correctedCount}`);
        } else {
            console.log(`(Run with '--apply' flag to apply fixes to database)`);
        }
        console.log(`--------------------------------------------------------------------\n`);

    } catch (err) {
        console.error('Reconciliation Error:', err);
    } finally {
        process.exit(0);
    }
}

runReconciliation();
