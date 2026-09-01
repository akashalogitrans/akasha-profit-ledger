/* ==========================================================================
   AKASHA LOGITRANS LLP - SERVICE MASTER CONTROLLER
   ========================================================================== */

const pool = require('../config/db');

// 1. GET ALL SERVICES
async function getServices(req, res) {
    try {
        const [rows] = await pool.execute(`SELECT * FROM services ORDER BY service_name ASC`);
        return res.json(rows || []);
    } catch (err) {
        console.error('Get Services Error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 2. CREATE NEW SERVICE
async function createService(req, res) {
    try {
        let { service_name, service_type, default_gst_pct, status } = req.body;
        if (!service_name || !service_name.trim()) {
            return res.status(400).json({ success: false, message: 'Service Name is required' });
        }

        service_name = service_name.trim();

        const [existing] = await pool.execute(`SELECT id FROM services WHERE LOWER(service_name) = LOWER(?)`, [service_name]);
        if (existing && existing.length > 0) {
            return res.status(400).json({ success: false, message: `Service '${service_name}' already exists.` });
        }

        const srvId = `SRV-${Date.now().toString().slice(-4)}`;

        await pool.execute(
            `INSERT INTO services (id, service_name, service_type, default_gst_pct, status) VALUES (?, ?, ?, ?, ?)`,
            [srvId, service_name, service_type || 'General', parseFloat(default_gst_pct) || 18.00, status || 'ACTIVE']
        );

        return res.status(201).json({ success: true, message: `Service ${service_name} created successfully`, service_id: srvId });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 3. UPDATE SERVICE
async function updateService(req, res) {
    try {
        const srvId = req.params.id;
        const { service_name, service_type, default_gst_pct, status } = req.body;

        if (!service_name || !service_name.trim()) {
            return res.status(400).json({ success: false, message: 'Service Name is required' });
        }

        await pool.execute(
            `UPDATE services SET service_name = ?, service_type = ?, default_gst_pct = ?, status = ? WHERE id = ?`,
            [service_name.trim(), service_type || 'General', parseFloat(default_gst_pct) || 0.00, status || 'ACTIVE', srvId]
        );

        return res.json({ success: true, message: `Service updated successfully` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

// 4. DELETE SERVICE
async function deleteService(req, res) {
    try {
        const srvId = req.params.id;
        if (!srvId) return res.status(400).json({ success: false, message: 'Service ID is required' });

        await pool.execute(`DELETE FROM services WHERE id = ?`, [srvId]);
        return res.json({ success: true, message: `Service ${srvId} deleted successfully` });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    getServices,
    createService,
    updateService,
    deleteService
};
