/* ==========================================================================
   AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP ENTERPRISE SERVER
   Hostinger Phusion Passenger & Pure Node.js Production Architecture
   ========================================================================== */

try { require('dotenv').config(); } catch (e) {}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const clientRoutes = require('./routes/clientRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const vendorPaymentRoutes = require('./routes/vendorPaymentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const expenseRoutes = require('./routes/expenseRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Global Express Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Canonical Static Web Assets: Served solely from /public/ directory
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// Health Check API Endpoint (Public)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        app: 'Akasha LogiTrans Freight ERP',
        database: 'Hostinger MySQL',
        canonical_static: 'public',
        timestamp: new Date().toISOString()
    });
});

// API Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/vendor-payments', vendorPaymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api', ledgerRoutes);

// API 404 Handler (Prevents unhandled /api requests from returning HTML)
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: `API endpoint '${req.originalUrl}' not found.` });
});

// Single Page Application Wildcard Route (Rewrites all client-side routes to canonical index.html)
app.get('*', (req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    const rootIndexPath = path.join(__dirname, 'index.html');
    return res.sendFile(rootIndexPath);
});

// Global Process Safety Guards
process.on('uncaughtException', (err) => {
    console.error('[Process Error] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('[Process Error] Unhandled Rejection:', reason);
});

// Export app instance required by Hostinger Phusion Passenger Engine
module.exports = app;

// Listen on Port (for Standalone Node.js Container & Direct Execution)
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Akasha LogiTrans Freight ERP Server active on port ${PORT}`);
    const { syncAllVendorsFromShipments } = require('./controllers/vendorController');
    setTimeout(async () => {
        try {
            await syncAllVendorsFromShipments();
        } catch (e) {}
    }, 1500);
});
