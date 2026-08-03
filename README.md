# Akasha LogiTrans LLP - Enterprise Freight ERP & Profit Ledger

Official Enterprise Freight Forwarding Accounting, Profit Ledger & Billing ERP System built for **Akasha LogiTrans LLP**.

---

## 🚀 Features & Architecture
- **Pure Hostinger MySQL Engine**: High-performance database connection pool using `mysql2/promise`. Zero SQLite dependencies.
- **Modular MVC Architecture**: Clean code structure with `config/`, `controllers/`, `middleware/`, `routes/`, and `public/`.
- **Single Page Application**: HTML5 pushState URL routing (`/shipment-entry`, `/payment-received`, `/purchase-entry`, `/profit-ledger`, `/client-master`).
- **Real-Time Financial Analytics**: Real-time KPI summary calculations (Total Revenue, Purchases, Net Profit, Pending Balance).
- **Voucher Generator**: Dedicated Payment Received, Purchase Entry, and Job Profit vouchers with 1-click JPG export.
- **Enterprise Excel Export**: Instant CSV/Excel data exporting for all master registers.
- **Mobile Touch Optimized**: Responsive layout supporting Desktop, Tablet, and Mobile devices.

---

## 🛠️ Environment Variables Configuration (.env)

Create a `.env` file in the root directory:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=u614117022_u614117022_erp
DB_USER=u614117022_u614117022_erp
DB_PASSWORD=Alt@7776
JWT_SECRET=akasha_erp_super_secret_jwt_key_2026
```

---

## 🗄️ Database Setup (Hostinger phpMyAdmin)

1. Open Hostinger **phpMyAdmin**.
2. Select target database `u614117022_u614117022_erp`.
3. Import `schema.sql` to initialize tables (`users`, `clients`, `shipments`).

---

## 💻 Local Development Setup

```bash
# 1. Install Production Dependencies
npm install

# 2. Start Application Server
npm start
```

App runs on `http://localhost:5000`.

---

## 🌐 Hostinger Node.js Hosting Deployment

1. Push latest code to GitHub repository `akasha-profit-ledger` (`main` branch).
2. Go to Hostinger **hPanel** -> **Git / Deployments** -> Click **Deploy**.
3. Go to **Setup Node.js App**:
   - Application Root: `/public_html/erp`
   - Application Startup File: `server.js`
   - Node.js Version: `18.x` or `20.x`
4. Click **Run NPM Install** (if needed) and **Restart Application**.

---

## 🔒 Authorized Director Access (3 Accounts)
- **Khushal Patel** (`CEO & Founder` | PIN: `7776` - `KHUSHAL`)
- **Dhruv Patel** (`Director - Rates & Procurement` | PIN: `7717` - `DHRUV`)
- **Yagnik Patel** (`Director - Finance & Audit` | PIN: `8866` - `YAGNIK`)
