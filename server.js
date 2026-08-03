/* ==========================================================================
   AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP ENTERPRISE SERVER
   Hostinger Phusion Passenger Compatible Entry Point (Pure MySQL Architecture)
   ========================================================================== */

try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const cors = require('cors');
const path = require('path');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const clientRoutes = require('./routes/clientRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Global Express Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static Web Assets Middleware (Serves both public/ and root directory)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

// API Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api', ledgerRoutes);

// Health Check API Endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        app: 'Akasha LogiTrans Freight ERP',
        database: 'Hostinger MySQL',
        timestamp: new Date().toISOString()
    });
});

// Single Page Application Wildcard Route (Rewrites all non-file requests to index.html)
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    const fallbackPath = path.join(__dirname, 'index.html');
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    return res.sendFile(fallbackPath);
});

// Export app instance required by Hostinger Phusion Passenger Node.js Engine
module.exports = app;

// Direct CLI Execution Listener
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Akasha LogiTrans Freight ERP Server running on port ${PORT}`);
        console.log(`Live Environment: http://localhost:${PORT}`);
    });
}
