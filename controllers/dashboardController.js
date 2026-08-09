/* ==========================================================================
   AKASHA LOGITRANS LLP - DASHBOARD CONTROLLER
   Actual Received Revenue, Pending Receivables, & Executive KPI Widgets
   ========================================================================== */

const pool = require('../config/db');

async function getKPIs(req, res) {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const monthStr = todayStr.substring(0, 7);

        // 1. Overall Financial & Shipment Metrics
        const kpiSql = `
            SELECT 
                COALESCE(SUM(LEAST(sale_amount, COALESCE(received_amount, 0))), 0) AS total_revenue,
                COALESCE(SUM(sale_amount), 0) AS total_sale_billed,
                COALESCE(SUM(purchase_amount), 0) AS total_purchase,
                COALESCE(SUM(net_profit), 0) AS net_profit,
                COALESCE(SUM(
                    GREATEST(0, sale_amount - LEAST(sale_amount, COALESCE(received_amount, 0)))
                ), 0) AS pending_payment,
                COUNT(id) AS total_shipments,
                SUM(CASE WHEN sale_status = 'Completed' OR (received_amount >= sale_amount AND sale_amount > 0) THEN 1 ELSE 0 END) AS completed_shipments,
                SUM(CASE WHEN sale_status != 'Completed' AND (received_amount < sale_amount OR sale_amount = 0) THEN 1 ELSE 0 END) AS pending_shipments
            FROM shipments
        `;
        const [kpiRows] = await pool.execute(kpiSql);
        const kpi = kpiRows[0] || {};

        // 2. Collection Metrics (Today & This Month)
        const collectionSql = `
            SELECT 
                COALESCE(SUM(CASE WHEN CAST(payment_date AS CHAR) = CAST(? AS CHAR) THEN amount ELSE 0 END), 0) AS todays_collection,
                COALESCE(SUM(CASE WHEN DATE_FORMAT(payment_date, '%Y-%m') = CAST(? AS CHAR) THEN amount ELSE 0 END), 0) AS monthly_collection
            FROM payment_transactions
        `;
        const [collRows] = await pool.execute(collectionSql, [todayStr, monthStr]);
        const coll = collRows[0] || {};

        // 3. Top Clients by Revenue
        const topClientsSql = `
            SELECT 
                company_name, 
                COUNT(id) as shipments, 
                SUM(sale_amount) as billed, 
                SUM(LEAST(sale_amount, COALESCE(received_amount, 0))) as received
            FROM shipments 
            GROUP BY company_name 
            ORDER BY billed DESC 
            LIMIT 5
        `;
        const [topClients] = await pool.execute(topClientsSql);

        // 4. Latest Payment Transactions
        const recentPaymentsSql = `
            SELECT pt.*, s.company_name 
            FROM payment_transactions pt
            JOIN shipments s ON (pt.shipment_id COLLATE utf8mb4_general_ci) = (s.id COLLATE utf8mb4_general_ci)
            ORDER BY pt.created_at DESC 
            LIMIT 6
        `;
        const [recentPayments] = await pool.execute(recentPaymentsSql);

        return res.json({
            success: true,
            monthly_revenue: parseFloat(kpi.total_revenue) || 0,
            total_sale_billed: parseFloat(kpi.total_sale_billed) || 0,
            total_purchase: parseFloat(kpi.total_purchase) || 0,
            net_profit: parseFloat(kpi.net_profit) || 0,
            pending_payment: parseFloat(kpi.pending_payment) || 0,
            total_shipments: parseInt(kpi.total_shipments) || 0,
            completed_shipments: parseInt(kpi.completed_shipments) || 0,
            pending_shipments: parseInt(kpi.pending_shipments) || 0,
            todays_collection: parseFloat(coll.todays_collection) || 0,
            monthly_collection: parseFloat(coll.monthly_collection) || 0,
            top_clients: topClients || [],
            recent_payments: recentPayments || []
        });
    } catch (err) {
        console.error('KPI Fetch Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getKPIs };
