/* ==========================================================================
   AKASHA LOGITRANS LLP - CENTRAL FINANCIAL CALCULATION ENGINE
   Single Source of Truth for Financial Totals, Taxes, Net Profit & Margins
   ========================================================================== */

/**
 * Safe numeric parser handling strings, null, undefined, NaN, and negative numbers.
 * @param {*} value - The input value to convert.
 * @param {number} fallback - The fallback value if invalid (default: 0).
 * @returns {number} Clean finite number.
 */
function safeNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

/**
 * Safe JSON parser that never throws or crashes the application on invalid JSON.
 * @param {string|*} jsonInput - String to parse or already parsed object.
 * @param {*} fallback - Fallback value if parsing fails (default: []).
 * @returns {*} Parsed value or fallback.
 */
function parseSafeJson(jsonInput, fallback = []) {
    if (!jsonInput) return fallback;
    if (typeof jsonInput === 'object') return jsonInput;
    if (typeof jsonInput !== 'string') return fallback;
    try {
        const parsed = JSON.parse(jsonInput);
        return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (err) {
        return fallback;
    }
}

/**
 * Calculates a single purchase line item.
 * @param {Object} item - Purchase item object.
 * @returns {Object} Normalized line item with calculated taxable, gst_amt, amount.
 */
function calculatePurchaseLineItem(item = {}) {
    const currency = item.currency || 'INR';
    const exRate = safeNumber(item.ex_rate, (currency === 'USD' ? 83.5 : (currency === 'EUR' ? 90.5 : 1.0)));
    const foreignAmt = safeNumber(item.foreign_amount, safeNumber(item.amount, 0));
    const gstPct = safeNumber(item.gst_pct, 0);

    // Taxable value = base foreign amount * exchange rate (or explicit taxable if specified)
    let taxable = foreignAmt > 0 ? (foreignAmt * exRate) : (item.taxable !== undefined ? safeNumber(item.taxable, 0) : 0);
    
    // Always calculate GST Amount dynamically from taxable and current gst_pct
    let gstAmt = (taxable * gstPct) / 100;

    // Line Total = Taxable + GST Amount
    let lineTotal = taxable + gstAmt;

    // If explicit amount was given and no taxable/foreign_amount, use explicit amount
    if (lineTotal === 0 && safeNumber(item.amount) > 0) {
        lineTotal = safeNumber(item.amount);
        taxable = gstPct > 0 ? (lineTotal / (1 + (gstPct / 100))) : lineTotal;
        gstAmt = lineTotal - taxable;
    }

    return {
        vendor_name: (item.vendor_name || 'General Vendor').trim(),
        expense_name: (item.expense_name || 'Freight').trim(),
        currency,
        ex_rate: exRate,
        foreign_amount: foreignAmt,
        taxable: Math.round(taxable * 100) / 100,
        gst_pct: gstPct,
        gst_amt: Math.round(gstAmt * 100) / 100,
        amount: Math.round(lineTotal * 100) / 100
    };
}

/**
 * Calculates total purchase cost and normalizes items array from raw items input.
 * @param {Array|string} itemsInput - Array of items or JSON string.
 * @returns {{ items: Array, totalPurchase: number, totalTaxable: number, totalGst: number }}
 */
function calculatePurchaseItems(itemsInput) {
    const rawItems = parseSafeJson(itemsInput, []);
    let totalPurchase = 0;
    let totalTaxable = 0;
    let totalGst = 0;
    const normalizedItems = [];

    if (Array.isArray(rawItems)) {
        for (const raw of rawItems) {
            const line = calculatePurchaseLineItem(raw);
            totalPurchase += line.amount;
            totalTaxable += line.taxable;
            totalGst += line.gst_amt;
            normalizedItems.push(line);
        }
    }

    return {
        items: normalizedItems,
        totalPurchase: Math.round(totalPurchase * 100) / 100,
        totalTaxable: Math.round(totalTaxable * 100) / 100,
        totalGst: Math.round(totalGst * 100) / 100
    };
}

/**
 * Calculates a single sales line item.
 * @param {Object} item - Sales item object.
 * @returns {Object} Normalized line item with calculated taxable, gst_amt, amount.
 */
function calculateSaleLineItem(item = {}) {
    const currency = item.currency || 'INR';
    const exRate = safeNumber(item.ex_rate, (currency === 'USD' ? 83.5 : (currency === 'EUR' ? 90.5 : 1.0)));
    const qty = safeNumber(item.qty, 1);
    const rate = safeNumber(item.rate, 0);
    const gstPct = safeNumber(item.gst_pct, 18);

    // Taxable = Qty * Rate * Exchange Rate
    let taxable = (qty * rate * exRate);
    if (taxable === 0 && item.taxable !== undefined && safeNumber(item.taxable) > 0) {
        taxable = safeNumber(item.taxable);
    }

    // Always calculate GST Amount dynamically from taxable and current gst_pct
    let gstAmt = (taxable * gstPct) / 100;

    // Line Total = Taxable + GST Amount
    let lineTotal = taxable + gstAmt;

    // If explicit amount was given and no rate/taxable, use explicit amount
    if (lineTotal === 0 && safeNumber(item.amount) > 0) {
        lineTotal = safeNumber(item.amount);
        taxable = gstPct > 0 ? (lineTotal / (1 + (gstPct / 100))) : lineTotal;
        gstAmt = lineTotal - taxable;
    }

    return {
        service_name: (item.service_name || 'Ocean Freight').trim(),
        currency,
        ex_rate: exRate,
        qty: qty,
        rate: rate,
        taxable: Math.round(taxable * 100) / 100,
        gst_pct: gstPct,
        gst_amt: Math.round(gstAmt * 100) / 100,
        amount: Math.round(lineTotal * 100) / 100
    };
}

/**
 * Calculates total sale billed and normalizes items array from raw items input.
 * @param {Array|string} itemsInput - Array of items or JSON string.
 * @returns {{ items: Array, totalSale: number, totalTaxable: number, totalGst: number }}
 */
function calculateSaleItems(itemsInput) {
    const rawItems = parseSafeJson(itemsInput, []);
    let totalSale = 0;
    let totalTaxable = 0;
    let totalGst = 0;
    const normalizedItems = [];

    if (Array.isArray(rawItems)) {
        for (const raw of rawItems) {
            const line = calculateSaleLineItem(raw);
            totalSale += line.amount;
            totalTaxable += line.taxable;
            totalGst += line.gst_amt;
            normalizedItems.push(line);
        }
    }

    return {
        items: normalizedItems,
        totalSale: Math.round(totalSale * 100) / 100,
        totalTaxable: Math.round(totalTaxable * 100) / 100,
        totalGst: Math.round(totalGst * 100) / 100
    };
}

/**
 * Calculates Net Job Profit: Sale Amount - Purchase Amount - Direct Expenses.
 * @param {number|string} saleAmount - Total sales billed.
 * @param {number|string} purchaseAmount - Total purchase cost.
 * @param {number|string} directExpenses - Any additional direct shipment expenses.
 * @returns {number} Net Profit.
 */
function calculateNetProfit(saleAmount, purchaseAmount, directExpenses = 0) {
    const sale = safeNumber(saleAmount, 0);
    const pur = safeNumber(purchaseAmount, 0);
    const exp = safeNumber(directExpenses, 0);
    return Math.round((sale - pur - exp) * 100) / 100;
}

/**
 * Calculates Margin Percentage: (Net Profit / Sale Amount) * 100.
 * Zero-safe rule: If saleAmount <= 0, returns 0.00 (No NaN, No Infinity, No -100).
 * @param {number|string} saleAmount - Total sales billed.
 * @param {number|string} netProfit - Calculated net profit.
 * @returns {number} Margin percentage (rounded to 2 decimal places).
 */
function calculateMarginPercentage(saleAmount, netProfit) {
    const sale = safeNumber(saleAmount, 0);
    const profit = safeNumber(netProfit, 0);

    if (sale <= 0) {
        return 0.0;
    }
    const margin = (profit / sale) * 100;
    return Math.round(margin * 100) / 100;
}

/**
 * Calculates Overall Summary Metrics for a list of financial rows.
 * @param {Array} rows - Array of items with sales_amount, purchase_amount, direct_expenses, net_profit.
 * @returns {Object} Aggregated totals and overall margin percentage.
 */
function calculateSummaryMetrics(rows = []) {
    let totalSales = 0;
    let totalPurchase = 0;
    let totalDirectExp = 0;
    let totalProfit = 0;
    let totalJobs = 0;

    for (const r of rows) {
        const s = safeNumber(r.sales_amount !== undefined ? r.sales_amount : r.sale_amount, 0);
        const p = safeNumber(r.purchase_amount, 0);
        const e = safeNumber(r.direct_expense_amount !== undefined ? r.direct_expense_amount : r.direct_expenses, 0);
        const profit = r.net_profit !== undefined ? safeNumber(r.net_profit) : calculateNetProfit(s, p, e);

        totalSales += s;
        totalPurchase += p;
        totalDirectExp += e;
        totalProfit += profit;
        totalJobs += 1;
    }

    const overallMargin = calculateMarginPercentage(totalSales, totalProfit);

    return {
        total_sales: Math.round(totalSales * 100) / 100,
        total_purchase: Math.round(totalPurchase * 100) / 100,
        total_direct_expenses: Math.round(totalDirectExp * 100) / 100,
        total_profit: Math.round(totalProfit * 100) / 100,
        overall_margin_pct: overallMargin,
        total_shipments: totalJobs
    };
}

module.exports = {
    safeNumber,
    parseSafeJson,
    calculatePurchaseLineItem,
    calculatePurchaseItems,
    calculateSaleLineItem,
    calculateSaleItems,
    calculateNetProfit,
    calculateMarginPercentage,
    calculateSummaryMetrics
};
