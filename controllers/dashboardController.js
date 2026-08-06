/* ==========================================================================
   AKASHA LOGITRANS LLP - DASHBOARD CONTROLLER
   ========================================================================== */

const pool = require('../config/db');

async function getKPIs(req, res) {
    try {
        const sql = `
            SELECT 
                COALESCE(SUM(sale_amount), 0) AS total_revenue,
                COALESCE(SUM(purchase_amount), 0) AS total_purchase,
                COALESCE(SUM(net_profit), 0) AS net_profit,
                COALESCE(SUM(
                    CASE 
                        WHEN sale_status = 'Completed' THEN 0 
                        WHEN COALESCE(received_amount, 0) >= sale_amount THEN 0
                        WHEN COALESCE(received_amount, 0) > 0 THEN (sale_amount - LEAST(sale_amount, received_amount))
                        ELSE sale_amount 
                    END
                ), 0) AS pending_payment
            FROM shipments
        `;
        
        const [rows] = await pool.execute(sql);
        const row = rows[0];

        return res.json({
            success: true,
            monthly_revenue: row ? parseFloat(row.total_revenue) || 0 : 0,
            total_purchase: row ? parseFloat(row.total_purchase) || 0 : 0,
            net_profit: row ? parseFloat(row.net_profit) || 0 : 0,
            pending_payment: row ? parseFloat(row.pending_payment) || 0 : 0
        });
    } catch (err) {
        console.error('KPI Fetch Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getKPIs };
