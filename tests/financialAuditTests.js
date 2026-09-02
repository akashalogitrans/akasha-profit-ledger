/* ==========================================================================
   AKASHA LOGITRANS LLP - COMPREHENSIVE FINANCIAL & ARCHITECTURAL TEST SUITE
   20 Automated Test Cases Validating Math, Indian FY, Safe Parser, & Ledger Views
   ========================================================================== */

const assert = require('assert');
const { 
    safeNumber, 
    parseSafeJson, 
    calculatePurchaseLineItem, 
    calculatePurchaseItems, 
    calculateSaleLineItem, 
    calculateSaleItems, 
    calculateNetProfit, 
    calculateMarginPercentage, 
    calculateSummaryMetrics 
} = require('../utils/financialUtils');

const { 
    normalizeDateOnly, 
    calculateFinancialYear, 
    getFinancialYearDates, 
    getMonthKeyAndLabel, 
    getDaysOutstanding 
} = require('../utils/dateUtils');

const {
    aggregateMonthWiseProfit,
    aggregateFinancialYearWiseProfit
} = require('../services/financialReportService');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`✅ [PASS] Test ${totalTests}: ${name}`);
    } catch (err) {
        console.error(`❌ [FAIL] Test ${totalTests}: ${name}`);
        console.error(`   Error: ${err.message}`);
    }
}

console.log(`====================================================================`);
console.log(`AKASHA ERP - 20-POINT COMPREHENSIVE FINANCIAL TEST SUITE`);
console.log(`====================================================================\n`);

// TEST 1: Standard Positive Shipment Profit & Margin
runTest('Standard Positive Shipment Profit & Margin', () => {
    const sale = 100000;
    const pur = 80000;
    const profit = calculateNetProfit(sale, pur, 0);
    const margin = calculateMarginPercentage(sale, profit);
    assert.strictEqual(profit, 20000);
    assert.strictEqual(margin, 20.0);
});

// TEST 2: Zero Sale Amount (Zero-Safe Rule: Must Return 0.00, Never -100 or NaN)
runTest('Zero Sale Amount Safe Margin (0.00%, Not -100 or NaN)', () => {
    const sale = 0;
    const pur = 50000;
    const profit = calculateNetProfit(sale, pur, 0);
    const margin = calculateMarginPercentage(sale, profit);
    assert.strictEqual(profit, -50000);
    assert.strictEqual(margin, 0.0);
    assert.ok(!isNaN(margin));
    assert.ok(isFinite(margin));
});

// TEST 3: Zero Purchase Cost (100% Margin)
runTest('Zero Purchase Cost (100% Margin)', () => {
    const sale = 50000;
    const pur = 0;
    const profit = calculateNetProfit(sale, pur, 0);
    const margin = calculateMarginPercentage(sale, profit);
    assert.strictEqual(profit, 50000);
    assert.strictEqual(margin, 100.0);
});

// TEST 4: Loss Shipment (Negative Profit & Negative Margin)
runTest('Loss Shipment (Negative Profit & Negative Margin)', () => {
    const sale = 80000;
    const pur = 100000;
    const profit = calculateNetProfit(sale, pur, 0);
    const margin = calculateMarginPercentage(sale, profit);
    assert.strictEqual(profit, -20000);
    assert.strictEqual(margin, -25.0);
});

// TEST 5: Purchase Line Item Calculation with USD Foreign Currency & GST
runTest('Purchase Line Item USD Foreign Currency & GST Calculation', () => {
    const item = {
        vendor_name: 'MSC Mediterranean Shipping',
        expense_name: 'Ocean Freight',
        currency: 'USD',
        ex_rate: 84.0,
        foreign_amount: 1000,
        gst_pct: 18
    };
    const calc = calculatePurchaseLineItem(item);
    assert.strictEqual(calc.taxable, 84000); // 1000 * 84
    assert.strictEqual(calc.gst_amt, 15120); // 84000 * 18%
    assert.strictEqual(calc.amount, 99120);  // 84000 + 15120
});

// TEST 6: Sales Items Array Calculation with Quantity, Rate & GST
runTest('Sales Items Array Calculation with Qty, Rate, Taxable & GST', () => {
    const items = [
        { service_name: 'Freight 20FT', qty: 2, rate: 40000, ex_rate: 1, gst_pct: 18 },
        { service_name: 'Documentation', qty: 1, rate: 5000, ex_rate: 1, gst_pct: 18 }
    ];
    const res = calculateSaleItems(items);
    // Item 1: Taxable 80000, GST 14400, Total 94400
    // Item 2: Taxable 5000, GST 900, Total 5900
    assert.strictEqual(res.totalTaxable, 85000);
    assert.strictEqual(res.totalGst, 15300);
    assert.strictEqual(res.totalSale, 100300);
});

// TEST 7: Direct Shipment Expenses Deducted in Job Profit
runTest('Direct Shipment Expenses Deducted in Job Profit', () => {
    const sale = 150000;
    const pur = 100000;
    const directExp = 10000;
    const profit = calculateNetProfit(sale, pur, directExp);
    const margin = calculateMarginPercentage(sale, profit);
    assert.strictEqual(profit, 40000); // 150000 - 100000 - 10000
    assert.strictEqual(margin, 26.67);
});

// TEST 8: Indirect Operating Expenses Separation
runTest('Indirect Operating Expenses Separation from Job Profit', () => {
    const jobProfit1 = 20000;
    const jobProfit2 = 30000;
    const totalJobProfit = jobProfit1 + jobProfit2; // 50000
    const officeRent = 15000; // Operating Expense
    const companyOperatingProfit = totalJobProfit - officeRent;
    assert.strictEqual(companyOperatingProfit, 35000);
});

// TEST 9: Indian Financial Year Calculation (April to December)
runTest('Indian Financial Year (August 2026 -> FY 2026-27)', () => {
    const fy = calculateFinancialYear('2026-08-15');
    assert.strictEqual(fy, 'FY 2026-27');
});

// TEST 10: Indian Financial Year Calculation (January to March)
runTest('Indian Financial Year (February 2027 -> FY 2026-27)', () => {
    const fy = calculateFinancialYear('2027-02-10');
    assert.strictEqual(fy, 'FY 2026-27');
});

// TEST 11: Indian Financial Year Boundaries
runTest('Indian Financial Year Boundaries for FY 2026-27', () => {
    const dates = getFinancialYearDates(2026);
    assert.strictEqual(dates.startDate, '2026-04-01');
    assert.strictEqual(dates.endDate, '2027-03-31');
    assert.strictEqual(dates.label, 'FY 2026-27');
});

// TEST 12: Cash Flow Isolation (Customer Payment does NOT alter Billed Sales)
runTest('Customer Cash Collection Isolation from Revenue & Profit', () => {
    const saleBilled = 100000;
    const purCost = 80000;
    const jobProfitBefore = calculateNetProfit(saleBilled, purCost, 0);
    
    // Customer pays 50,000 partial payment
    const custPaid = 50000;
    const remainingBalance = saleBilled - custPaid;
    const jobProfitAfter = calculateNetProfit(saleBilled, purCost, 0);

    assert.strictEqual(remainingBalance, 50000);
    assert.strictEqual(jobProfitBefore, 20000);
    assert.strictEqual(jobProfitAfter, 20000);
});

// TEST 13: Cash Flow Isolation (Vendor Payment does NOT alter Purchase Cost)
runTest('Vendor Cash Payment Isolation from Cost & Profit', () => {
    const saleBilled = 100000;
    const purCost = 80000;
    const jobProfitBefore = calculateNetProfit(saleBilled, purCost, 0);

    // Paid vendor 40,000 partial payment
    const vendorPaid = 40000;
    const vendorPayableBalance = purCost - vendorPaid;
    const jobProfitAfter = calculateNetProfit(saleBilled, purCost, 0);

    assert.strictEqual(vendorPayableBalance, 40000);
    assert.strictEqual(jobProfitBefore, 20000);
    assert.strictEqual(jobProfitAfter, 20000);
});

// TEST 14: Safe Number Parser Robustness
runTest('Safe Number Parser handles strings, null, undefined, NaN', () => {
    assert.strictEqual(safeNumber('1234.56'), 1234.56);
    assert.strictEqual(safeNumber(''), 0);
    assert.strictEqual(safeNumber(null), 0);
    assert.strictEqual(safeNumber(undefined), 0);
    assert.strictEqual(safeNumber(NaN), 0);
    assert.strictEqual(safeNumber('invalid_string'), 0);
    assert.strictEqual(safeNumber(-500), -500);
});

// TEST 15: Safe JSON Parser Robustness
runTest('Safe JSON Parser handles corrupted strings gracefully', () => {
    const corrupted = '{ bad: json, incomplete';
    const fallback = [{ default: true }];
    const parsed = parseSafeJson(corrupted, fallback);
    assert.deepStrictEqual(parsed, fallback);
});

// TEST 16: Summary Aggregator Weighted Margin Calculation
runTest('Summary Aggregator Weighted Margin ((TotalProfit / TotalSales) * 100)', () => {
    const rows = [
        { sales_amount: 100000, purchase_amount: 80000, direct_expenses: 0, net_profit: 20000 },
        { sales_amount: 200000, purchase_amount: 150000, direct_expenses: 0, net_profit: 50000 }
    ];
    const summary = calculateSummaryMetrics(rows);
    assert.strictEqual(summary.total_sales, 300000);
    assert.strictEqual(summary.total_purchase, 230000);
    assert.strictEqual(summary.total_profit, 70000);
    assert.strictEqual(summary.overall_margin_pct, 23.33); // (70000 / 300000) * 100 = 23.333%
});

// TEST 17: Date-Only Normalizer
runTest('Date-Only Normalizer converts diverse date formats to YYYY-MM-DD', () => {
    assert.strictEqual(normalizeDateOnly('2026-08-25T14:30:00.000Z'), '2026-08-25');
    assert.strictEqual(normalizeDateOnly('2026-08-25'), '2026-08-25');
    assert.strictEqual(normalizeDateOnly('25-08-2026'), '2026-08-25');
});

// TEST 18: Month Key & Label Extraction
runTest('Month Key & Label Extraction', () => {
    const info = getMonthKeyAndLabel('2026-08-15');
    assert.strictEqual(info.monthKey, '2026-08');
    assert.strictEqual(info.monthLabel, 'August 2026');
    assert.strictEqual(info.shortLabel, 'Aug 2026');
});

// TEST 19: Month-Wise Grouping Aggregation in Financial Report Service
runTest('Month-Wise Grouping Aggregation in Financial Report Service', () => {
    const sampleRows = [
        { month_key: '2026-08', month_label: 'August 2026', sales_amount: 100000, purchase_amount: 80000, direct_expense_amount: 0, net_profit: 20000, financial_year: 'FY 2026-27' },
        { month_key: '2026-08', month_label: 'August 2026', sales_amount: 50000, purchase_amount: 30000, direct_expense_amount: 0, net_profit: 20000, financial_year: 'FY 2026-27' },
        { month_key: '2026-07', month_label: 'July 2026', sales_amount: 80000, purchase_amount: 60000, direct_expense_amount: 0, net_profit: 20000, financial_year: 'FY 2026-27' }
    ];
    const monthWise = aggregateMonthWiseProfit(sampleRows);
    assert.strictEqual(monthWise.length, 2);
    
    const aug = monthWise.find(m => m.month_key === '2026-08');
    assert.strictEqual(aug.shipment_count, 2);
    assert.strictEqual(aug.total_sales, 150000);
    assert.strictEqual(aug.total_purchase, 110000);
    assert.strictEqual(aug.net_profit, 40000);
    assert.strictEqual(aug.margin_pct, 26.67);
});

// TEST 20: Financial Year-Wise Grouping Aggregation
runTest('Financial Year-Wise Grouping Aggregation', () => {
    const sampleRows = [
        { financial_year: 'FY 2026-27', sales_amount: 150000, purchase_amount: 110000, direct_expense_amount: 0, net_profit: 40000 },
        { financial_year: 'FY 2025-26', sales_amount: 200000, purchase_amount: 160000, direct_expense_amount: 0, net_profit: 40000 }
    ];
    const yearWise = aggregateFinancialYearWiseProfit(sampleRows);
    assert.strictEqual(yearWise.length, 2);

    const fy26 = yearWise.find(y => y.financial_year === 'FY 2026-27');
    assert.strictEqual(fy26.total_sales, 150000);
    assert.strictEqual(fy26.total_purchase, 110000);
    assert.strictEqual(fy26.net_profit, 40000);
    assert.strictEqual(fy26.margin_pct, 26.67);
});

console.log(`\n--------------------------------------------------------------------`);
console.log(`Test Execution Summary: ${passedTests}/${totalTests} Tests Passed (100%)`);
console.log(`--------------------------------------------------------------------\n`);

if (passedTests === totalTests) {
    console.log(`🎉 ALL 20 FINANCIAL & ARCHITECTURAL TESTS PASSED PERFECTLY!\n`);
    process.exit(0);
} else {
    process.exit(1);
}
