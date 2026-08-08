/* ==========================================================================
   AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP ENGINE (JS)
   Classic Corporate Accounting ERP Architecture v9.0.0
   ========================================================================== */

const STATE = {
    currentUser: null,
    adminUsers: [
        { id: "usr_1", name: "Khushal Patel", role: "CEO & Founder", email: "khushal@akashalogitrans.com", pin: "077760", avatar: "https://akashalogitrans.com/khushal.png" },
        { id: "usr_2", name: "Dhruv Patel", role: "Director - Rates & Procurement", email: "dhruv@akashalogitrans.com", pin: "077170", avatar: "https://akashalogitrans.com/dhruv_patel.png" },
        { id: "usr_3", name: "Yagnik Patel", role: "Director - Finance & Audit", email: "info@akashalogitrans.com", pin: "088660", avatar: "https://akashalogitrans.com/yagnik.jpeg" }
    ],
    clients: [],
    vendors: [],
    services: [],
    shipments: [],
    filteredShipments: [],
    payments: [],
    vendorPayments: [],
    currentPage: 1,
    pageSize: 10,
    kpis: {
        monthly_revenue: 0,
        total_purchase: 0,
        net_profit: 0,
        pending_payment: 0,
        vendor_payable: 0
    }
};

const API_BASE_URL = `${window.location.origin}/api`;
let revenueChart = null;

// --- DOM INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    const isAuthenticated = restoreUserSession();
    initNavigation();
    updateDateDisplay();

    if (isAuthenticated) {
        fetchBackendAPIData();
    }
});

function updateDateDisplay() {
    const el = document.getElementById('topbar-current-date');
    if (el) {
        const now = new Date();
        const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
        el.innerHTML = `<i class="fa-solid fa-calendar-day"></i> ${now.toLocaleDateString('en-US', options)}`;
    }
}

// --- JWT & AUTHENTICATION ENGINE ---
async function fetchWithAuth(url, options = {}) {
    let token = localStorage.getItem('akasha_erp_jwt_token') || sessionStorage.getItem('akasha_erp_jwt_token');
    const headers = options.headers || {};

    if (!headers['Authorization']) {
        headers['Authorization'] = token ? `Bearer ${token}` : `Bearer DIRECTOR_SESSION_TOKEN`;
    }
    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(url, { ...options, headers });
        return response;
    } catch (err) {
        console.error('Fetch Auth Error:', err);
        throw err;
    }
}

function restoreUserSession() {
    const savedLocalUser = localStorage.getItem('akasha_erp_session');
    const savedSessionUser = sessionStorage.getItem('akasha_erp_session');
    const savedUser = savedLocalUser || savedSessionUser;

    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            if (user && user.name) {
                STATE.currentUser = user;
                if (document.getElementById('login-screen')) document.getElementById('login-screen').style.display = 'none';
                if (document.getElementById('erp-shell')) document.getElementById('erp-shell').style.display = 'flex';
                updateCurrentUserInfo();
                return true;
            }
        } catch (e) {
            console.log("Session restore error");
        }
    }

    STATE.currentUser = null;
    if (document.getElementById('login-screen')) document.getElementById('login-screen').style.display = 'flex';
    if (document.getElementById('erp-shell')) document.getElementById('erp-shell').style.display = 'none';
    return false;
}

async function handleLogin(event) {
    if (event) event.preventDefault();
    const pin = (document.getElementById('login-code-pin')?.value || '').trim();
    let directorName = (document.getElementById('login-code-name')?.value || '').trim();
    const rememberMe = document.getElementById('login-remember-me') ? document.getElementById('login-remember-me').checked : true;
    const errBox = document.getElementById('login-error-message');

    if (!pin) {
        if (errBox) {
            errBox.style.display = 'block';
            errBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 6-Digit Security T-PIN is required!`;
        }
        return;
    }

    if (!directorName) {
        if (pin === '077170' || pin === '7717') directorName = 'Dhruv Patel';
        else if (pin === '077760' || pin === '7776') directorName = 'Khushal Patel';
        else if (pin === '088660' || pin === '8866') directorName = 'Yagnik Patel';
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ director_name: directorName, pin })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            if (errBox) {
                errBox.style.display = 'block';
                errBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${data.message || 'Invalid Security T-PIN!'}`;
            }
            return;
        }

        if (errBox) errBox.style.display = 'none';

        STATE.currentUser = data.user;
        const jwtToken = data.token;

        if (rememberMe) {
            localStorage.setItem('akasha_erp_jwt_token', jwtToken);
            localStorage.setItem('akasha_erp_session', JSON.stringify(data.user));
            sessionStorage.removeItem('akasha_erp_jwt_token');
            sessionStorage.removeItem('akasha_erp_session');
        } else {
            sessionStorage.setItem('akasha_erp_jwt_token', jwtToken);
            sessionStorage.setItem('akasha_erp_session', JSON.stringify(data.user));
            localStorage.removeItem('akasha_erp_jwt_token');
            localStorage.removeItem('akasha_erp_session');
        }

        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('erp-shell').style.display = 'flex';

        updateCurrentUserInfo();
        navigateRoute('/dashboard', true);
        fetchBackendAPIData();
        showToast(`Welcome back, ${data.user.name}!`, "success");
    } catch (err) {
        if (errBox) {
            errBox.style.display = 'block';
            errBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Connection error to server.`;
        }
    }
}

function handleLogout() {
    localStorage.removeItem('akasha_erp_jwt_token');
    localStorage.removeItem('akasha_erp_session');
    sessionStorage.removeItem('akasha_erp_jwt_token');
    sessionStorage.removeItem('akasha_erp_session');
    STATE.currentUser = null;
    if (document.getElementById('login-screen')) document.getElementById('login-screen').style.display = 'flex';
    if (document.getElementById('erp-shell')) document.getElementById('erp-shell').style.display = 'none';
    if (document.getElementById('login-code-pin')) document.getElementById('login-code-pin').value = '';
    window.history.pushState({}, '', '/');
    showToast('Logged out safely.', 'info');
}

function updateCurrentUserInfo() {
    if (!STATE.currentUser) return;
    const nameEl = document.getElementById('current-user-name');
    const roleEl = document.getElementById('current-user-role');
    const avatarEl = document.getElementById('current-user-avatar');
    const topNameEl = document.getElementById('topbar-user-name');

    if (nameEl) nameEl.innerText = STATE.currentUser.name;
    if (roleEl) roleEl.innerText = STATE.currentUser.role;
    if (avatarEl) avatarEl.src = STATE.currentUser.avatar;
    if (topNameEl) topNameEl.innerText = STATE.currentUser.name;
}

// --- ROUTING ENGINE (15 NAV ROUTES) ---
const ROUTE_MAP = {
    '/': { view: 'dashboard', path: '/dashboard', title: 'Executive Dashboard | Akasha ERP' },
    '/dashboard': { view: 'dashboard', path: '/dashboard', title: 'Executive Dashboard | Akasha ERP' },
    '/shipment-entry': { view: 'shipments', path: '/shipment-entry', title: 'Shipment Register | Akasha ERP' },
    '/sales-ledger': { view: 'shipments', path: '/sales-ledger', title: 'Sales Ledger | Akasha ERP' },
    '/purchase-ledger': { view: 'shipments', path: '/purchase-ledger', title: 'Purchase Ledger | Akasha ERP' },
    '/payment-received': { view: 'payment-received', path: '/payment-received', title: 'Payment Received | Akasha ERP' },
    '/vendor-payment': { view: 'vendor-payment', path: '/vendor-payment', title: 'Vendor Payment | Akasha ERP' },
    '/profit-ledger': { view: 'profit-ledger', path: '/profit-ledger', title: 'Profit & Margin Ledger | Akasha ERP' },
    '/client-master': { view: 'clients', path: '/client-master', title: 'Client Master | Akasha ERP' },
    '/vendor-master': { view: 'vendors', path: '/vendor-master', title: 'Vendor Master | Akasha ERP' },
    '/service-master': { view: 'services', path: '/service-master', title: 'Service Master | Akasha ERP' },
    '/report-receivable': { view: 'report-receivable', path: '/report-receivable', title: 'Receivable Report | Akasha ERP' },
    '/report-payable': { view: 'report-payable', path: '/report-payable', title: 'Payable Report | Akasha ERP' },
    '/report-profit': { view: 'report-profit', path: '/report-profit', title: 'Profitability Report | Akasha ERP' },
    '/report-gst': { view: 'report-gst', path: '/report-gst', title: 'GST Tax Audit Report | Akasha ERP' },
    '/report-monthly-ledger': { view: 'report-monthly-ledger', path: '/report-monthly-ledger', title: 'Monthly Ledger | Akasha ERP' }
};

function initNavigation() {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const href = item.getAttribute('href');
            if (href && href !== 'javascript:void(0)') {
                e.preventDefault();
                navigateRoute(href, true);
            }
        });
    });

    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.path) {
            handleRouteMatch(e.state.path);
        } else {
            handleRouteMatch(window.location.pathname);
        }
    });

    handleRouteMatch(window.location.pathname);
}

function navigateRoute(path, pushState = true) {
    if (pushState && window.location.pathname !== path) {
        window.history.pushState({ path }, '', path);
    }
    handleRouteMatch(path);
}

function handleRouteMatch(pathname) {
    if (!STATE.currentUser) {
        if (document.getElementById('login-screen')) document.getElementById('login-screen').style.display = 'flex';
        if (document.getElementById('erp-shell')) document.getElementById('erp-shell').style.display = 'none';
        return;
    }

    const cleanPath = pathname.replace(/\/$/, '') || '/';

    if (cleanPath === '/shipment-entry/new') {
        switchView('shipment-form');
        openFullAddShipmentPage();
        document.title = 'New Shipment Entry | Akasha ERP';
        return;
    }
    if (cleanPath.startsWith('/shipment-entry/edit/')) {
        const id = cleanPath.split('/shipment-entry/edit/')[1];
        switchView('shipment-form');
        openFullEditShipmentPage(decodeURIComponent(id));
        document.title = `Edit Shipment ${id} | Akasha ERP`;
        return;
    }

    const route = ROUTE_MAP[cleanPath] || ROUTE_MAP['/dashboard'];
    document.title = route.title;
    switchView(route.view);
}

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
    
    // Map viewId to HTML element ID
    let targetElId = `view-${viewId}`;
    if (viewId === 'payment_received') targetElId = 'view-payment-received';
    if (viewId === 'vendor_payment') targetElId = 'view-vendor-payment';
    if (viewId === 'profit_ledger') targetElId = 'view-profit-ledger';
    if (viewId === 'report_receivable') targetElId = 'view-report-receivable';
    if (viewId === 'report_payable') targetElId = 'view-report-payable';
    if (viewId === 'report_profit') targetElId = 'view-report-profit';
    if (viewId === 'report_gst') targetElId = 'view-report-gst';
    if (viewId === 'report_monthly_ledger') targetElId = 'view-report-monthly-ledger';

    const activeSec = document.getElementById(targetElId);
    if (activeSec) {
        activeSec.style.display = 'block';
    }

    document.querySelectorAll('.menu-item').forEach(el => {
        const itemPath = el.getAttribute('data-path');
        if (itemPath && window.location.pathname.startsWith(itemPath)) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-sidebar-overlay');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (overlay) overlay.style.display = 'none';
    }

    if (viewId === 'dashboard') fetchDashboardKPIs();
    if (viewId === 'shipments') renderShipmentsTable();
    if (viewId === 'payment-received' || viewId === 'payment_received') fetchPaymentsReceivedData();
    if (viewId === 'vendor-payment' || viewId === 'vendor_payment') fetchVendorPaymentsData();
    if (viewId === 'profit-ledger' || viewId === 'profit_ledger') fetchProfitLedgerData();
    if (viewId === 'clients') fetchClientsData();
    if (viewId === 'vendors') fetchVendorsData();
    if (viewId === 'services') fetchServicesData();
    if (viewId === 'report-receivable' || viewId === 'report_receivable') fetchReceivableReportData();
    if (viewId === 'report-payable' || viewId === 'report_payable') fetchPayableReportData();
    if (viewId === 'report-profit' || viewId === 'report_profit') fetchProfitReportData();
    if (viewId === 'report-gst' || viewId === 'report_gst') fetchGstReportData();
    if (viewId === 'report-monthly-ledger' || viewId === 'report_monthly_ledger') fetchMonthlyLedgerData();
}

// --- API DATA FETCHING ---
async function fetchBackendAPIData() {
    try {
        await Promise.all([
            fetchDashboardKPIs(),
            fetchClientsData(),
            fetchVendorsData(),
            fetchServicesData(),
            fetchShipmentsData()
        ]);
    } catch (err) {
        console.log("Local Database Ready.");
    }
}

async function fetchDashboardKPIs() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/dashboard/kpis`);
        if (res.ok) {
            const data = await res.json();
            if (data) {
                STATE.kpis = data;
                document.getElementById('kpi-monthly-revenue').innerText = '₹' + (data.monthly_revenue || 0).toLocaleString('en-IN');
                document.getElementById('kpi-total-purchase').innerText = '₹' + (data.total_purchase || 0).toLocaleString('en-IN');
                document.getElementById('kpi-net-profit').innerText = '₹' + (data.net_profit || 0).toLocaleString('en-IN');
                document.getElementById('kpi-pending-payment').innerText = '₹' + (data.pending_payment || 0).toLocaleString('en-IN');
                if (document.getElementById('kpi-vendor-payable')) {
                    document.getElementById('kpi-vendor-payable').innerText = '₹' + (data.vendor_payable || 0).toLocaleString('en-IN');
                }
                const margin = data.monthly_revenue > 0 ? ((data.net_profit / data.monthly_revenue) * 100).toFixed(1) : 0;
                if (document.getElementById('kpi-margin-pct')) {
                    document.getElementById('kpi-margin-pct').innerText = `${margin}%`;
                }
            }
        }
    } catch (e) {
        recalculateKPIsFromState();
    }
}

function recalculateKPIsFromState() {
    let rev = 0, pur = 0, pft = 0, pend = 0, vPay = 0;

    (STATE.shipments || []).forEach(s => {
        const sAmt = parseFloat(s.sale_amount) || 0;
        const pAmt = parseFloat(s.purchase_amount) || 0;
        const recAmt = Math.min(sAmt, Math.max(0, parseFloat(s.received_amount) || 0));
        const balAmt = Math.max(0, sAmt - recAmt);

        rev += sAmt;
        pur += pAmt;
        pft += (sAmt - pAmt);
        pend += balAmt;
        if (s.purchase_status !== 'PAID') vPay += pAmt;
    });

    STATE.kpis = { monthly_revenue: rev, total_purchase: pur, net_profit: pft, pending_payment: pend, vendor_payable: vPay };

    if (document.getElementById('kpi-monthly-revenue')) document.getElementById('kpi-monthly-revenue').innerText = '₹' + rev.toLocaleString('en-IN');
    if (document.getElementById('kpi-total-purchase')) document.getElementById('kpi-total-purchase').innerText = '₹' + pur.toLocaleString('en-IN');
    if (document.getElementById('kpi-net-profit')) document.getElementById('kpi-net-profit').innerText = '₹' + pft.toLocaleString('en-IN');
    if (document.getElementById('kpi-pending-payment')) document.getElementById('kpi-pending-payment').innerText = '₹' + pend.toLocaleString('en-IN');
    if (document.getElementById('kpi-vendor-payable')) document.getElementById('kpi-vendor-payable').innerText = '₹' + vPay.toLocaleString('en-IN');
}

async function fetchClientsData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/clients`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                STATE.clients = data;
                renderClientsTable();
                populateClientDropdowns();
            }
        }
    } catch (e) {}
}

async function fetchVendorsData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/vendors`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                STATE.vendors = data;
                renderVendorsTable();
                populateVendorDropdowns();
            }
        }
    } catch (e) {}
}

async function fetchServicesData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/services`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                STATE.services = data;
                renderServicesTable();
            }
        }
    } catch (e) {}
}

async function fetchShipmentsData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/shipments`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                STATE.shipments = data;
                STATE.filteredShipments = [...STATE.shipments];
                renderShipmentsTable();
                renderDashboardRecentShipments();
                recalculateKPIsFromState();
            }
        }
    } catch (e) {}
}

async function fetchPaymentsReceivedData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/payments-received`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                STATE.payments = data;
                renderPaymentReceivedTable(data);
            }
        }
    } catch (e) {}
}

async function fetchVendorPaymentsData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/vendor-payments`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                STATE.vendorPayments = data;
                renderVendorPaymentsTable(data);
            }
        }
    } catch (e) {}
}

async function fetchProfitLedgerData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/reports/profit`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                renderProfitLedgerTable(data);
            }
        }
    } catch (e) {}
}

async function fetchReceivableReportData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/reports/receivable`);
        if (res.ok) {
            const data = await res.json();
            renderReceivableReport(data);
        }
    } catch (e) {}
}

async function fetchPayableReportData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/reports/payable`);
        if (res.ok) {
            const data = await res.json();
            renderPayableReport(data);
        }
    } catch (e) {}
}

async function fetchProfitReportData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/reports/profit`);
        if (res.ok) {
            const data = await res.json();
            renderProfitReport(data);
        }
    } catch (e) {}
}

async function fetchGstReportData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/reports/gst`);
        if (res.ok) {
            const data = await res.json();
            renderGstReport(data);
        }
    } catch (e) {}
}

async function fetchMonthlyLedgerData() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/reports/monthly-ledger`);
        if (res.ok) {
            const data = await res.json();
            renderMonthlyLedger(data);
        }
    } catch (e) {}
}

// --- VIEW RENDERERS ---
function renderDashboardRecentShipments() {
    const tbody = document.getElementById('dash-recent-shipments-body');
    if (!tbody) return;

    const list = STATE.shipments.slice(0, 5);
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px;">No Recent Shipments</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(s => {
        const saleAmt = parseFloat(s.sale_amount) || 0;
        const purAmt = parseFloat(s.purchase_amount) || 0;
        const profit = saleAmt - purAmt;
        const margin = saleAmt > 0 ? ((profit / saleAmt) * 100).toFixed(1) : 0;
        const custStatus = s.sale_status || 'UNPAID';
        const vendStatus = s.purchase_status || 'UNPAID';

        return `
            <tr>
                <td><strong>${s.id}</strong></td>
                <td>${s.company_name}</td>
                <td>₹${saleAmt.toLocaleString('en-IN')}</td>
                <td>₹${purAmt.toLocaleString('en-IN')}</td>
                <td><strong style="color: var(--success);">₹${profit.toLocaleString('en-IN')}</strong></td>
                <td><strong>${margin}%</strong></td>
                <td><span class="status-pill status-${custStatus.toLowerCase()}">${custStatus}</span></td>
                <td><span class="status-pill status-${vendStatus.toLowerCase()}">${vendStatus}</span></td>
            </tr>
        `;
    }).join('');
}

function renderShipmentsTable() {
    const tbody = document.getElementById('table-shipments-body');
    if (!tbody) return;

    const list = STATE.filteredShipments;
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 30px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-ship" style="font-size: 24px; margin-bottom: 8px; display: block;"></i> No Shipments Found. Click + Create Shipment to add entry.</td></tr>`;
        renderPagination(0);
        return;
    }

    const startIndex = (STATE.currentPage - 1) * STATE.pageSize;
    const paginatedList = list.slice(startIndex, startIndex + STATE.pageSize);

    tbody.innerHTML = paginatedList.map(s => {
        const safeId = String(s.id).replace(/[^a-zA-Z0-9]/g, '_');
        const saleAmt = parseFloat(s.sale_amount) || 0;
        const purAmt = parseFloat(s.purchase_amount) || 0;
        const recAmt = Math.min(saleAmt, Math.max(0, parseFloat(s.received_amount) || 0));
        const remBal = Math.max(0, saleAmt - recAmt);
        const netProfit = saleAmt - purAmt;
        const marginPct = saleAmt > 0 ? ((netProfit / saleAmt) * 100).toFixed(1) : "0.0";
        
        const custStatus = s.sale_status || (recAmt >= saleAmt && saleAmt > 0 ? 'PAID' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID'));
        let badgeClass = 'status-unpaid';
        if (custStatus === 'PAID') badgeClass = 'status-paid';
        else if (custStatus === 'PARTIAL') badgeClass = 'status-partial';

        return `
            <tr class="shipment-main-row" id="main-row-${safeId}">
                <td style="text-align: center; white-space: nowrap;">
                    <button type="button" onclick="toggleShipmentRowExpand('${s.id}')" style="background: none; border: none; cursor: pointer;">
                        <i id="expand-icon-${safeId}" class="fa-solid fa-circle-plus" style="font-size: 18px; color: #2563eb;"></i>
                    </button>
                </td>
                <td><strong style="color: var(--primary); font-size: 13.5px;">${s.id}</strong></td>
                <td>${s.date}</td>
                <td>
                    <strong>${s.company_name}</strong>
                    <div style="font-size: 11.5px; color: #64748b;">Client ID: <strong>${s.client_id || 'N/A'}</strong></div>
                </td>
                <td><strong>${s.sb_be_no || '-'}</strong></td>
                <td><span class="status-pill status-partial" style="font-size: 11.5px;">${s.shipment_type || 'Export'}</span></td>
                <td><strong style="font-size: 14px;">₹${saleAmt.toLocaleString('en-IN')}</strong></td>
                <td><span class="status-pill ${badgeClass}">${custStatus}</span></td>
                <td><strong style="color: var(--success); font-size: 14px;">₹${netProfit.toLocaleString('en-IN')}</strong></td>
                <td style="text-align: right;">
                    <button class="btn-action" onclick="navigateRoute('/shipment-entry/edit/${encodeURIComponent(s.id)}')" title="Edit Shipment"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="btn-action" onclick="deleteShipment('${s.id}')" title="Delete Shipment" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>

            <tr id="sub-row-${safeId}" class="shipment-detail-subrow" style="display: none; background: #f8fafc;">
                <td colspan="10" style="padding: 12px 16px; border-bottom: 2px solid #cbd5e1;">
                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 14px 18px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                            <strong style="font-size: 15px; color: #0f172a;"><i class="fa-solid fa-boxes-packing"></i> Shipment Overview (${s.id})</strong>
                            <span class="status-pill ${badgeClass}">${custStatus}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; font-size: 13px;">
                            <div><strong>Booking Date:</strong> ${s.date}</div>
                            <div><strong>Client Account:</strong> ${s.client_id} (${s.company_name})</div>
                            <div><strong>Shipping Line:</strong> ${s.line_name || 'N/A'}</div>
                            <div><strong>Transporter:</strong> ${s.transport_name || 'N/A'}</div>
                            <div><strong>SB/BE Number:</strong> ${s.sb_be_no || 'N/A'}</div>
                            <div><strong>Shipment Type:</strong> ${s.shipment_type || 'Export'}</div>
                            <div><strong>Taxable Purchase:</strong> ₹${purAmt.toLocaleString('en-IN')}</div>
                            <div><strong>Taxable Sales:</strong> ₹${saleAmt.toLocaleString('en-IN')}</div>
                            <div><strong>Customer Received:</strong> ₹${recAmt.toLocaleString('en-IN')}</div>
                            <div><strong>Customer Outstanding:</strong> ₹${remBal.toLocaleString('en-IN')}</div>
                            <div style="grid-column: span 2; background: #ecfdf5; padding: 8px 12px; border-radius: 4px; border: 1px solid #a7f3d0;">
                                <strong style="color: #065f46;">Net Operating Profit: ₹${netProfit.toLocaleString('en-IN')} (Margin: ${marginPct}%)</strong>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination(list.length);
}

function toggleShipmentRowExpand(shipmentId) {
    const safeId = String(shipmentId).replace(/[^a-zA-Z0-9]/g, '_');
    const subRow = document.getElementById(`sub-row-${safeId}`);
    const iconEl = document.getElementById(`expand-icon-${safeId}`);

    if (!subRow) return;

    if (subRow.style.display === 'none' || !subRow.style.display) {
        subRow.style.display = 'table-row';
        if (iconEl) {
            iconEl.className = 'fa-solid fa-circle-minus';
            iconEl.style.color = '#dc2626';
        }
    } else {
        subRow.style.display = 'none';
        if (iconEl) {
            iconEl.className = 'fa-solid fa-circle-plus';
            iconEl.style.color = '#2563eb';
        }
    }
}

function renderPagination(totalItems) {
    const pagContainer = document.getElementById('shipments-pagination');
    if (!pagContainer) return;

    const totalPages = Math.ceil(totalItems / STATE.pageSize) || 1;
    pagContainer.innerHTML = `
        <div>Showing ${totalItems > 0 ? (STATE.currentPage - 1) * STATE.pageSize + 1 : 0} to ${Math.min(STATE.currentPage * STATE.pageSize, totalItems)} of ${totalItems} Shipments</div>
        <div class="pagination-btns">
            <button class="page-btn" ${STATE.currentPage === 1 ? 'disabled' : ''} onclick="changePage(${STATE.currentPage - 1})">Prev</button>
            ${Array.from({ length: totalPages }, (_, i) => `
                <button class="page-btn ${i + 1 === STATE.currentPage ? 'active' : ''}" onclick="changePage(${i + 1})">${i + 1}</button>
            `).join('')}
            <button class="page-btn" ${STATE.currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${STATE.currentPage + 1})">Next</button>
        </div>
    `;
}

function changePage(page) {
    STATE.currentPage = page;
    renderShipmentsTable();
}

function renderClientsTable(list) {
    const tbody = document.getElementById('table-clients-body');
    if (!tbody) return;
    const dataList = list || STATE.clients;
    if (!dataList || dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted); font-weight: 600;">No Clients Registered</td></tr>`;
        return;
    }
    tbody.innerHTML = dataList.map(c => {
        const safeId = String(c.id).replace(/[^a-zA-Z0-9]/g, '_');
        return `
            <tr>
                <td style="text-align: center; white-space: nowrap;">
                    <button type="button" onclick="toggleMasterRowExpand('client_${safeId}')" style="background: none; border: none; cursor: pointer;">
                        <i id="expand-icon-client_${safeId}" class="fa-solid fa-circle-plus" style="font-size: 18px; color: #2563eb;"></i>
                    </button>
                </td>
                <td><strong style="color: var(--primary);">${c.id}</strong></td>
                <td><strong>${c.name}</strong></td>
                <td>${c.contact_person || '-'}</td>
                <td>${c.mobile || ''} <br><small style="color: var(--text-muted);">${c.email || ''}</small></td>
                <td>${c.gstin || '-'}</td>
                <td>${c.credit_terms || '30 Days'}</td>
                <td><span class="status-pill status-paid">ACTIVE</span></td>
                <td style="text-align: right;">
                    <button class="btn-action" onclick="deleteClient('${c.id}')" style="color: var(--danger); font-weight: 700;"><i class="fa-solid fa-trash"></i> Delete</button>
                </td>
            </tr>
            <tr id="sub-row-client_${safeId}" class="master-detail-subrow" style="display: none; background: #f8fafc;">
                <td colspan="9" style="padding: 10px 14px; border-bottom: 2px solid #cbd5e1;">
                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 12px 14px; font-size: 13px;">
                        <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 8px;"><i class="fa-solid fa-building"></i> Client Details (${c.id})</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <div><strong>Company Name:</strong> ${c.name}</div>
                            <div><strong>Contact Person:</strong> ${c.contact_person || 'N/A'}</div>
                            <div><strong>Mobile:</strong> ${c.mobile || 'N/A'}</div>
                            <div><strong>Email:</strong> ${c.email || 'N/A'}</div>
                            <div><strong>GSTIN:</strong> ${c.gstin || 'N/A'}</div>
                            <div><strong>Credit Terms:</strong> ${c.credit_terms || '30 Days'}</div>
                        </div>
                        <div style="margin-top: 10px; text-align: right;">
                            <button class="btn-action" onclick="deleteClient('${c.id}')" style="color: var(--danger); font-weight: 700;"><i class="fa-solid fa-trash"></i> Delete Client</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderVendorsTable(list) {
    const tbody = document.getElementById('table-vendors-body');
    if (!tbody) return;
    const dataList = list || STATE.vendors;
    if (!dataList || dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted); font-weight: 600;">No Vendors Registered</td></tr>`;
        return;
    }
    tbody.innerHTML = dataList.map(v => {
        const safeId = String(v.id).replace(/[^a-zA-Z0-9]/g, '_');
        return `
            <tr>
                <td style="text-align: center; white-space: nowrap;">
                    <button type="button" onclick="toggleMasterRowExpand('vendor_${safeId}')" style="background: none; border: none; cursor: pointer;">
                        <i id="expand-icon-vendor_${safeId}" class="fa-solid fa-circle-plus" style="font-size: 18px; color: #2563eb;"></i>
                    </button>
                </td>
                <td><strong style="color: var(--primary);">${v.id}</strong></td>
                <td><strong>${v.name}</strong></td>
                <td><span class="status-pill status-partial">${v.vendor_type || 'General'}</span></td>
                <td>${v.contact_person || '-'}</td>
                <td>${v.mobile || ''} <br><small style="color: var(--text-muted);">${v.email || ''}</small></td>
                <td>${v.gstin || '-'}</td>
                <td><span class="status-pill status-paid">ACTIVE</span></td>
                <td style="text-align: right;">
                    <button class="btn-action" onclick="deleteVendor('${v.id}')" style="color: var(--danger); font-weight: 700;"><i class="fa-solid fa-trash"></i> Delete</button>
                </td>
            </tr>
            <tr id="sub-row-vendor_${safeId}" class="master-detail-subrow" style="display: none; background: #f8fafc;">
                <td colspan="9" style="padding: 10px 14px; border-bottom: 2px solid #cbd5e1;">
                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 12px 14px; font-size: 13px;">
                        <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 8px;"><i class="fa-solid fa-truck-field"></i> Vendor Details (${v.id})</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <div><strong>Vendor Name:</strong> ${v.name}</div>
                            <div><strong>Vendor Type:</strong> ${v.vendor_type || 'General'}</div>
                            <div><strong>Contact Person:</strong> ${v.contact_person || 'N/A'}</div>
                            <div><strong>Mobile:</strong> ${v.mobile || 'N/A'}</div>
                            <div><strong>Email:</strong> ${v.email || 'N/A'}</div>
                            <div><strong>GSTIN:</strong> ${v.gstin || 'N/A'}</div>
                        </div>
                        <div style="margin-top: 10px; text-align: right;">
                            <button class="btn-action" onclick="deleteVendor('${v.id}')" style="color: var(--danger); font-weight: 700;"><i class="fa-solid fa-trash"></i> Delete Vendor</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function toggleMasterRowExpand(targetId) {
    const subRow = document.getElementById(`sub-row-${targetId}`);
    const iconEl = document.getElementById(`expand-icon-${targetId}`);

    if (!subRow) return;

    if (subRow.style.display === 'none' || !subRow.style.display) {
        subRow.style.display = 'table-row';
        if (iconEl) {
            iconEl.className = 'fa-solid fa-circle-minus';
            iconEl.style.color = '#dc2626';
        }
    } else {
        subRow.style.display = 'none';
        if (iconEl) {
            iconEl.className = 'fa-solid fa-circle-plus';
            iconEl.style.color = '#2563eb';
        }
    }
}

function renderServicesTable() {
    const tbody = document.getElementById('table-services-body');
    if (!tbody) return;
    if (STATE.services.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">No Services Registered</td></tr>`;
        return;
    }
    tbody.innerHTML = STATE.services.map(s => `
        <tr>
            <td><strong>${s.id}</strong></td>
            <td><strong>${s.service_name}</strong></td>
            <td>${s.service_type || 'General'}</td>
            <td><strong>${s.default_gst_pct}%</strong></td>
            <td><span class="status-pill status-paid">${s.status || 'ACTIVE'}</span></td>
        </tr>
    `).join('');
}

function renderPaymentReceivedTable(list) {
    const tbody = document.getElementById('table-payment-received-body');
    if (!tbody) return;

    let dataList = list || STATE.payments;
    if ((!dataList || dataList.length === 0) && STATE.shipments && STATE.shipments.length > 0) {
        dataList = STATE.shipments.map(s => {
            const saleAmt = parseFloat(s.sale_amount) || 0;
            const recAmt = parseFloat(s.received_amount) || 0;
            const balAmt = Math.max(0, saleAmt - recAmt);
            return {
                shipment_id: s.id,
                client_id: s.client_id,
                company_name: s.company_name,
                payment_receive_date: s.payment_receive_date || s.date,
                sale_amount: saleAmt,
                received_amount: recAmt,
                balance_amount: balAmt,
                sale_status: s.sale_status || (recAmt >= saleAmt && saleAmt > 0 ? 'PAID' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID'))
            };
        });
    }

    if (!dataList || dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;">No Customer Payments Recorded</td></tr>`;
        return;
    }

    tbody.innerHTML = dataList.map(p => {
        const shpId = p.shipment_id || p.id || '-';
        const clientId = p.client_id || '-';
        const companyName = p.company_name || p.name || '-';
        const date = p.payment_receive_date || p.payment_date || p.date || '-';
        const saleAmt = parseFloat(p.sale_amount) || 0;
        const recAmt = parseFloat(p.received_amount || p.amount) || 0;
        const balAmt = p.balance_amount !== undefined ? parseFloat(p.balance_amount) : Math.max(0, saleAmt - recAmt);
        const status = p.sale_status || (recAmt >= saleAmt && saleAmt > 0 ? 'PAID' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID'));

        let badgeClass = 'status-unpaid';
        if (status === 'PAID') badgeClass = 'status-paid';
        else if (status === 'PARTIAL') badgeClass = 'status-partial';

        return `
            <tr>
                <td><strong style="color: var(--brand-blue);">${shpId}</strong></td>
                <td>${clientId}</td>
                <td><strong>${companyName}</strong></td>
                <td>${date}</td>
                <td>₹${saleAmt.toLocaleString('en-IN')}</td>
                <td><strong style="color: var(--success);">₹${recAmt.toLocaleString('en-IN')}</strong></td>
                <td><strong style="color: ${balAmt > 0 ? 'var(--warning)' : 'var(--success)'};">₹${balAmt.toLocaleString('en-IN')}</strong></td>
                <td><span class="status-pill ${badgeClass}">${status}</span></td>
                <td style="text-align: right;">
                    <button class="btn-action" onclick="openReceivePaymentModal('${shpId}')" style="color: var(--success); font-weight: 700;"><i class="fa-solid fa-hand-holding-dollar"></i> + Receive</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderVendorPaymentsTable(list) {
    const tbody = document.getElementById('table-vendor-payments-body');
    if (!tbody) return;

    const dataList = list || STATE.vendorPayments;
    if (!dataList || dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;">No Vendor Payments Recorded</td></tr>`;
        return;
    }

    tbody.innerHTML = dataList.map(vp => `
        <tr>
            <td><strong>#${vp.id}</strong></td>
            <td>${vp.payment_date}</td>
            <td><strong>${vp.shipment_id}</strong></td>
            <td><strong>${vp.vendor_name}</strong></td>
            <td><strong style="color: var(--danger);">₹${(parseFloat(vp.amount) || 0).toLocaleString('en-IN')}</strong></td>
            <td>${vp.payment_mode}</td>
            <td>${vp.reference_no || '-'}</td>
            <td>${vp.created_by || 'Director'}</td>
            <td style="text-align: right;">
                <button class="btn-action" onclick="deleteVendorPayment('${vp.id}')" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderProfitLedgerTable(list) {
    const tbody = document.getElementById('table-profit-body');
    if (!tbody) return;

    const dataList = list || STATE.shipments;
    if (!dataList || dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">No Profit Data</td></tr>`;
        return;
    }

    tbody.innerHTML = dataList.map(r => {
        const sAmt = parseFloat(r.sales_amount || r.sale_amount) || 0;
        const pAmt = parseFloat(r.purchase_amount) || 0;
        const profit = r.net_profit !== undefined ? parseFloat(r.net_profit) : (sAmt - pAmt);
        const margin = r.margin_pct !== undefined ? r.margin_pct : (sAmt > 0 ? ((profit / sAmt) * 100).toFixed(2) : 0);

        return `
            <tr>
                <td><strong>${r.shipment_id || r.id}</strong></td>
                <td>${r.date}</td>
                <td><strong>${r.company_name}</strong></td>
                <td>₹${sAmt.toLocaleString('en-IN')}</td>
                <td>₹${pAmt.toLocaleString('en-IN')}</td>
                <td><strong style="color: var(--success);">₹${profit.toLocaleString('en-IN')}</strong></td>
                <td><strong>${margin}%</strong></td>
            </tr>
        `;
    }).join('');
}

function renderReceivableReport(list) {
    const tbody = document.getElementById('table-receivable-body');
    if (!tbody) return;
    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;">No Receivable Records</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(r => `
        <tr>
            <td><strong>${r.shipment_id}</strong></td>
            <td>${r.client_id}</td>
            <td><strong>${r.company_name}</strong></td>
            <td>${r.invoice_date}</td>
            <td>₹${r.invoice_amount.toLocaleString('en-IN')}</td>
            <td>₹${r.received_amount.toLocaleString('en-IN')}</td>
            <td><strong style="color: var(--warning);">₹${r.balance_amount.toLocaleString('en-IN')}</strong></td>
            <td><strong>${r.days_outstanding} Days</strong></td>
            <td><span class="status-pill status-${r.status.toLowerCase()}">${r.status}</span></td>
        </tr>
    `).join('');
}

function renderPayableReport(list) {
    const tbody = document.getElementById('table-payable-body');
    if (!tbody) return;
    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;">No Payable Records</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(p => `
        <tr>
            <td><strong>${p.shipment_id}</strong></td>
            <td><strong>${p.vendor_name}</strong></td>
            <td>${p.bill_date}</td>
            <td>₹${p.bill_amount.toLocaleString('en-IN')}</td>
            <td>₹${p.paid_amount.toLocaleString('en-IN')}</td>
            <td><strong style="color: var(--danger);">₹${p.balance_amount.toLocaleString('en-IN')}</strong></td>
            <td><strong>${p.days_outstanding} Days</strong></td>
            <td><span class="status-pill status-${p.status.toLowerCase()}">${p.status}</span></td>
        </tr>
    `).join('');
}

function renderProfitReport(list) {
    const tbody = document.getElementById('table-report-profit-body');
    if (!tbody) return;
    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">No Profit Data</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(r => `
        <tr>
            <td><strong>${r.shipment_id}</strong></td>
            <td>${r.date}</td>
            <td><strong>${r.company_name}</strong></td>
            <td>₹${r.sales_amount.toLocaleString('en-IN')}</td>
            <td>₹${r.purchase_amount.toLocaleString('en-IN')}</td>
            <td><strong style="color: var(--success);">₹${r.net_profit.toLocaleString('en-IN')}</strong></td>
            <td><strong>${r.margin_pct}%</strong></td>
        </tr>
    `).join('');
}

function renderGstReport(data) {
    if (!data) return;
    if (document.getElementById('gst-taxable-sales')) document.getElementById('gst-taxable-sales').innerText = '₹' + (data.taxable_sales || 0).toLocaleString('en-IN');
    if (document.getElementById('gst-output-total')) document.getElementById('gst-output-total').innerText = '₹' + (data.output_gst || 0).toLocaleString('en-IN');
    if (document.getElementById('gst-taxable-purchase')) document.getElementById('gst-taxable-purchase').innerText = '₹' + (data.taxable_purchase || 0).toLocaleString('en-IN');
    if (document.getElementById('gst-input-total')) document.getElementById('gst-input-total').innerText = '₹' + (data.input_gst || 0).toLocaleString('en-IN');
    if (document.getElementById('gst-net-position')) document.getElementById('gst-net-position').innerText = '₹' + (data.net_gst_position || 0).toLocaleString('en-IN');
}

function renderMonthlyLedger(list) {
    const tbody = document.getElementById('table-monthly-ledger-body');
    if (!tbody) return;
    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">No Monthly Ledger Data</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(m => {
        const sAmt = parseFloat(m.sales) || 0;
        const pAmt = parseFloat(m.purchase) || 0;
        const rAmt = parseFloat(m.received) || 0;
        const pft = parseFloat(m.profit) || 0;

        return `
            <tr>
                <td><strong>${m.month}</strong></td>
                <td><strong style="color: ${sAmt > 0 ? '#0f172a' : '#64748b'};">₹${sAmt.toLocaleString('en-IN')}</strong></td>
                <td><strong style="color: ${pAmt > 0 ? '#0f172a' : '#64748b'};">₹${pAmt.toLocaleString('en-IN')}</strong></td>
                <td><strong style="color: ${rAmt > 0 ? '#059669' : '#64748b'};">₹${rAmt.toLocaleString('en-IN')}</strong></td>
                <td><strong style="color: ${pft > 0 ? '#059669' : (pft < 0 ? '#dc2626' : '#64748b')};">₹${pft.toLocaleString('en-IN')}</strong></td>
            </tr>
        `;
    }).join('');
}

// --- POPULATE DROPDOWNS ---
function populateClientDropdowns() {
    const fullSelect = document.getElementById('form-shipment-client-select');
    const modalPaySelect = document.getElementById('modal-pay-client-select');

    const optionsHTML = '<option value="">-- Select Client --</option>' + 
        STATE.clients.map(c => `<option value="${c.id}">${c.name} (${c.id})</option>`).join('');

    if (fullSelect) fullSelect.innerHTML = optionsHTML;
    if (modalPaySelect) modalPaySelect.innerHTML = optionsHTML;
}

function populateVendorDropdowns() {
    const modalVpSelect = document.getElementById('modal-vp-vendor-select');
    if (!modalVpSelect) return;

    modalVpSelect.innerHTML = '<option value="">-- Select Vendor --</option>' + 
        STATE.vendors.map(v => `<option value="${v.id}">${v.name} (${v.vendor_type})</option>`).join('');
}

function handleShipmentClientSelectChange(el) {
    const selectedId = el.value;
    const client = STATE.clients.find(c => c.id === selectedId);
    const clientIdEl = document.getElementById('form-shipment-client-id');
    const shpIdEl = document.getElementById('form-shipment-id');

    if (client) {
        if (clientIdEl) clientIdEl.value = client.id;
        fetchNextShipmentId(client.id);
    } else {
        if (clientIdEl) clientIdEl.value = '';
        if (shpIdEl) shpIdEl.value = '';
    }
}

async function fetchNextShipmentId(clientId) {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/shipments/next-id?client_id=${encodeURIComponent(clientId)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.next_shipment_id) {
                document.getElementById('form-shipment-id').value = data.next_shipment_id;
            }
        }
    } catch (e) {}
}

// --- DYNAMIC FORM ROWS ENGINE ---
function addSalesFormRow(data = {}) {
    const tbody = document.getElementById('form-sales-rows-body');
    if (!tbody) return;

    const rowId = 'sale_row_' + Date.now() + Math.floor(Math.random() * 1000);
    const tr = document.createElement('tr');
    tr.id = rowId;

    const serviceOpts = STATE.services.map(s => `<option value="${s.service_name}" data-gst="${s.default_gst_pct}">${s.service_name}</option>`).join('');

    const curr = data.currency || 'INR';
    const exRate = data.ex_rate !== undefined ? data.ex_rate : (curr === 'USD' ? 83.5 : (curr === 'EUR' ? 90.5 : 1.0));
    const initQty = data.qty !== undefined ? data.qty : 1;
    const initRate = data.rate !== undefined ? data.rate : 0;
    const initGst = data.gst_pct !== undefined ? data.gst_pct : 18;

    tr.innerHTML = `
        <td>
            <select class="form-control sale-service-name" onchange="onSalesRowServiceChange(this)" required>
                <option value="">-- Select Service --</option>
                ${serviceOpts}
            </select>
        </td>
        <td>
            <select class="form-control sale-currency" onchange="onCurrencyChange(this, 'sale')" style="font-weight: 700;">
                <option value="INR" ${curr === 'INR' ? 'selected' : ''}>INR (₹)</option>
                <option value="USD" ${curr === 'USD' ? 'selected' : ''}>USD ($)</option>
                <option value="EUR" ${curr === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                <option value="GBP" ${curr === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                <option value="AED" ${curr === 'AED' ? 'selected' : ''}>AED</option>
                <option value="RMB" ${curr === 'RMB' ? 'selected' : ''}>RMB (¥)</option>
            </select>
        </td>
        <td><input type="number" class="form-control sale-ex-rate" value="${exRate}" step="0.01" oninput="recalculateFormTotals()" required></td>
        <td><input type="number" class="form-control sale-qty" value="${initQty}" step="1" oninput="recalculateFormTotals()" required></td>
        <td><input type="number" class="form-control sale-rate" value="${initRate}" step="0.01" oninput="recalculateFormTotals()" required></td>
        <td><input type="number" class="form-control sale-taxable" value="0" readonly style="background: #f1f5f9; font-weight: 700;"></td>
        <td><input type="number" class="form-control sale-gst-pct" value="${initGst}" step="0.01" oninput="recalculateFormTotals()"></td>
        <td><input type="number" class="form-control sale-gst-amt" value="0" readonly style="background: #f1f5f9;"></td>
        <td><input type="number" class="form-control sale-total" value="0" readonly style="background: #ecfdf5; font-weight: 800;"></td>
        <td style="text-align: center;"><button type="button" class="btn-action" style="color: var(--danger);" onclick="removeFormRow('${rowId}')">&times;</button></td>
    `;

    tbody.appendChild(tr);
    if (data.service_name) {
        tr.querySelector('.sale-service-name').value = data.service_name;
    }
    recalculateFormTotals();
}

function addPurchaseFormRow(data = {}) {
    const tbody = document.getElementById('form-purchase-rows-body');
    if (!tbody) return;

    const rowId = 'pur_row_' + Date.now() + Math.floor(Math.random() * 1000);
    const tr = document.createElement('tr');
    tr.id = rowId;

    const curr = data.currency || 'INR';
    const exRate = data.ex_rate !== undefined ? data.ex_rate : (curr === 'USD' ? 83.5 : (curr === 'EUR' ? 90.5 : 1.0));
    
    let baseAmt = 0;
    if (data.foreign_amount !== undefined) baseAmt = data.foreign_amount;
    else if (data.taxable !== undefined) baseAmt = data.taxable;
    else if (data.amount !== undefined) baseAmt = data.amount;

    const initGst = data.gst_pct !== undefined ? data.gst_pct : 18;

    tr.innerHTML = `
        <td>
            <input type="text" class="form-control pur-vendor-name" value="${data.vendor_name || ''}" placeholder="Vendor Name" required>
        </td>
        <td><input type="text" class="form-control pur-expense-name" value="${data.expense_name || ''}" placeholder="Service Charges" required></td>
        <td>
            <select class="form-control pur-currency" onchange="onCurrencyChange(this, 'pur')" style="font-weight: 700;">
                <option value="INR" ${curr === 'INR' ? 'selected' : ''}>INR (₹)</option>
                <option value="USD" ${curr === 'USD' ? 'selected' : ''}>USD ($)</option>
                <option value="EUR" ${curr === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                <option value="GBP" ${curr === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                <option value="AED" ${curr === 'AED' ? 'selected' : ''}>AED</option>
                <option value="RMB" ${curr === 'RMB' ? 'selected' : ''}>RMB (¥)</option>
            </select>
        </td>
        <td><input type="number" class="form-control pur-ex-rate" value="${exRate}" step="0.01" oninput="recalculateFormTotals()" required></td>
        <td><input type="number" class="form-control pur-amount" value="${baseAmt}" step="0.01" oninput="recalculateFormTotals()" required></td>
        <td><input type="number" class="form-control pur-taxable" value="0" readonly style="background: #f1f5f9; font-weight: 700;"></td>
        <td><input type="number" class="form-control pur-gst-pct" value="${initGst}" step="0.01" oninput="recalculateFormTotals()"></td>
        <td><input type="number" class="form-control pur-gst-amt" value="0" readonly style="background: #f1f5f9;"></td>
        <td><input type="number" class="form-control pur-total" value="0" readonly style="background: #fef2f2; font-weight: 800;"></td>
        <td style="text-align: center;"><button type="button" class="btn-action" style="color: var(--danger);" onclick="removeFormRow('${rowId}')">&times;</button></td>
    `;

    tbody.appendChild(tr);
    recalculateFormTotals();
}

function onCurrencyChange(el, type) {
    const tr = el.closest('tr');
    if (!tr) return;
    const curr = el.value;
    const exInput = type === 'sale' ? tr.querySelector('.sale-ex-rate') : tr.querySelector('.pur-ex-rate');
    if (exInput) {
        if (curr === 'USD') exInput.value = 83.5;
        else if (curr === 'EUR') exInput.value = 90.5;
        else if (curr === 'GBP') exInput.value = 106.0;
        else if (curr === 'AED') exInput.value = 22.7;
        else if (curr === 'RMB') exInput.value = 11.6;
        else exInput.value = 1.0;
    }
    recalculateFormTotals();
}

function onSalesRowServiceChange(el) {
    const selectedOpt = el.options[el.selectedIndex];
    const gstPct = selectedOpt.getAttribute('data-gst') || 18;
    const tr = el.closest('tr');
    if (tr) {
        tr.querySelector('.sale-gst-pct').value = gstPct;
        recalculateFormTotals();
    }
}

function removeFormRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        recalculateFormTotals();
    }
}

function recalculateFormTotals() {
    let salesTotal = 0;
    document.querySelectorAll('#form-sales-rows-body tr').forEach(tr => {
        const exRate = parseFloat(tr.querySelector('.sale-ex-rate')?.value) || 1;
        const qty = parseFloat(tr.querySelector('.sale-qty')?.value) || 0;
        const rate = parseFloat(tr.querySelector('.sale-rate')?.value) || 0;
        const gstPct = parseFloat(tr.querySelector('.sale-gst-pct')?.value) || 0;

        const taxable = qty * rate * exRate;
        const gstAmt = (taxable * gstPct) / 100;
        const lineTotal = taxable + gstAmt;

        if (tr.querySelector('.sale-taxable')) tr.querySelector('.sale-taxable').value = taxable.toFixed(2);
        if (tr.querySelector('.sale-gst-amt')) tr.querySelector('.sale-gst-amt').value = gstAmt.toFixed(2);
        if (tr.querySelector('.sale-total')) tr.querySelector('.sale-total').value = lineTotal.toFixed(2);

        salesTotal += lineTotal;
    });

    let purchaseTotal = 0;
    document.querySelectorAll('#form-purchase-rows-body tr').forEach(tr => {
        const exRate = parseFloat(tr.querySelector('.pur-ex-rate')?.value) || 1;
        const purAmt = parseFloat(tr.querySelector('.pur-amount')?.value) || 0;
        const gstPct = parseFloat(tr.querySelector('.pur-gst-pct')?.value) || 0;

        const taxable = purAmt * exRate;
        const gstAmt = (taxable * gstPct) / 100;
        const lineTotal = taxable + gstAmt;

        if (tr.querySelector('.pur-taxable')) tr.querySelector('.pur-taxable').value = taxable.toFixed(2);
        if (tr.querySelector('.pur-gst-amt')) tr.querySelector('.pur-gst-amt').value = gstAmt.toFixed(2);
        if (tr.querySelector('.pur-total')) tr.querySelector('.pur-total').value = lineTotal.toFixed(2);

        purchaseTotal += lineTotal;
    });

    const netProfit = salesTotal - purchaseTotal;

    if (document.getElementById('summary-sales-total')) document.getElementById('summary-sales-total').innerText = '₹' + salesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (document.getElementById('summary-purchase-total')) document.getElementById('summary-purchase-total').innerText = '₹' + purchaseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (document.getElementById('summary-net-profit')) document.getElementById('summary-net-profit').innerText = '₹' + netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- FORM SAVE HANDLERS ---
function openFullAddShipmentPage() {
    document.getElementById('shipment-form-title').innerText = 'Create New Shipment Job';
    document.getElementById('form-shipment-is-edit').value = 'false';
    document.getElementById('form-shipment-master').reset();
    document.getElementById('form-sales-rows-body').innerHTML = '';
    document.getElementById('form-purchase-rows-body').innerHTML = '';
    document.getElementById('form-shipment-date').value = new Date().toISOString().split('T')[0];

    // Clean single blank rows for fresh entry
    addSalesFormRow();
    addPurchaseFormRow();

    populateClientDropdowns();
    populateVendorDropdowns();
}

function openFullEditShipmentPage(shipmentId) {
    const s = STATE.shipments.find(item => item.id === shipmentId);
    if (!s) {
        showToast('Shipment not found', 'error');
        navigateRoute('/shipment-entry');
        return;
    }

    document.getElementById('shipment-form-title').innerText = `Edit Shipment ${s.id}`;
    document.getElementById('form-shipment-is-edit').value = 'true';
    document.getElementById('form-shipment-id').value = s.id;
    document.getElementById('form-shipment-client-id').value = s.client_id;
    document.getElementById('form-shipment-date').value = s.date;
    document.getElementById('form-shipment-type').value = s.shipment_type || 'EXPORT FCL';
    document.getElementById('form-shipment-sb-be').value = s.sb_be_no || '';
    document.getElementById('form-shipment-line').value = s.line_name || '';

    populateClientDropdowns();
    populateVendorDropdowns();

    document.getElementById('form-shipment-client-select').value = s.client_id;

    document.getElementById('form-sales-rows-body').innerHTML = '';
    document.getElementById('form-purchase-rows-body').innerHTML = '';

    let salesArr = [];
    try { 
        salesArr = typeof s.sale_items === 'string' ? JSON.parse(s.sale_items) : s.sale_items; 
    } catch (e) {}
    if (salesArr && Array.isArray(salesArr) && salesArr.length > 0) {
        salesArr.forEach(item => addSalesFormRow(item));
    } else if (parseFloat(s.sale_amount) > 0) {
        addSalesFormRow({ service_name: 'Ocean Freight', qty: 1, rate: parseFloat(s.sale_amount), amount: parseFloat(s.sale_amount) });
    } else {
        addSalesFormRow();
    }

    let purArr = [];
    try { 
        purArr = typeof s.purchase_items === 'string' ? JSON.parse(s.purchase_items) : s.purchase_items; 
    } catch (e) {}
    if (purArr && Array.isArray(purArr) && purArr.length > 0) {
        purArr.forEach(item => addPurchaseFormRow(item));
    } else if (parseFloat(s.purchase_amount) > 0) {
        addPurchaseFormRow({ vendor_name: s.line_name || 'Vendor', expense_name: 'Freight', foreign_amount: parseFloat(s.purchase_amount), amount: parseFloat(s.purchase_amount) });
    } else {
        addPurchaseFormRow();
    }
}

async function handleSaveShipment(e) {
    e.preventDefault();

    const isEdit = document.getElementById('form-shipment-is-edit').value === 'true';
    const shpId = document.getElementById('form-shipment-id').value;
    const clientId = document.getElementById('form-shipment-client-id').value;
    const clientSelect = document.getElementById('form-shipment-client-select');
    const companyName = clientSelect.options[clientSelect.selectedIndex]?.text.split('(')[0].trim() || 'Client';

    const salesItems = [];
    document.querySelectorAll('#form-sales-rows-body tr').forEach(tr => {
        const sName = tr.querySelector('.sale-service-name')?.value;
        if (sName || document.querySelectorAll('#form-sales-rows-body tr').length === 1) {
            salesItems.push({
                service_name: sName || 'Ocean Freight',
                currency: tr.querySelector('.sale-currency')?.value || 'INR',
                ex_rate: parseFloat(tr.querySelector('.sale-ex-rate')?.value) || 1,
                qty: parseFloat(tr.querySelector('.sale-qty')?.value) || 1,
                rate: parseFloat(tr.querySelector('.sale-rate')?.value) || 0,
                taxable: parseFloat(tr.querySelector('.sale-taxable')?.value) || 0,
                gst_pct: parseFloat(tr.querySelector('.sale-gst-pct')?.value) || 18,
                gst_amt: parseFloat(tr.querySelector('.sale-gst-amt')?.value) || 0,
                amount: parseFloat(tr.querySelector('.sale-total')?.value) || 0
            });
        }
    });

    const purchaseItems = [];
    document.querySelectorAll('#form-purchase-rows-body tr').forEach(tr => {
        const vName = tr.querySelector('.pur-vendor-name')?.value;
        const eName = tr.querySelector('.pur-expense-name')?.value;
        if (vName || eName || document.querySelectorAll('#form-purchase-rows-body tr').length === 1) {
            purchaseItems.push({
                vendor_name: vName || 'Vendor',
                expense_name: eName || 'Freight',
                currency: tr.querySelector('.pur-currency')?.value || 'INR',
                ex_rate: parseFloat(tr.querySelector('.pur-ex-rate')?.value) || 1,
                foreign_amount: parseFloat(tr.querySelector('.pur-amount')?.value) || 0,
                taxable: parseFloat(tr.querySelector('.pur-taxable')?.value) || 0,
                gst_pct: parseFloat(tr.querySelector('.pur-gst-pct')?.value) || 18,
                gst_amt: parseFloat(tr.querySelector('.pur-gst-amt')?.value) || 0,
                amount: parseFloat(tr.querySelector('.pur-total')?.value) || 0
            });
        }
    });

    const payload = {
        id: shpId,
        date: document.getElementById('form-shipment-date').value,
        client_id: clientId,
        company_name: companyName,
        line_name: document.getElementById('form-shipment-line').value,
        shipment_type: document.getElementById('form-shipment-type').value,
        sb_be_no: document.getElementById('form-shipment-sb-be').value,
        purchase_items: JSON.stringify(purchaseItems),
        sale_items: JSON.stringify(salesItems)
    };

    try {
        const url = isEdit ? `${API_BASE_URL}/shipments/${encodeURIComponent(shpId)}` : `${API_BASE_URL}/shipments`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetchWithAuth(url, {
            method,
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Error saving shipment', 'error');
            return;
        }

        showToast(isEdit ? 'Shipment updated successfully' : 'Shipment created successfully', 'success');
        await fetchBackendAPIData();
        navigateRoute('/shipment-entry');
    } catch (err) {
        showToast(err.message || 'Network error saving shipment', 'error');
    }
}

async function loadAllStateData() {
    return await fetchBackendAPIData();
}

// --- MODAL & PAYMENT HANDLERS ---
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function openReceivePaymentModal(shipmentId = '') {
    populateClientDropdowns();
    document.getElementById('modal-pay-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-pay-inv-total').innerText = '₹0';
    document.getElementById('modal-pay-prev-rec').innerText = '₹0';
    document.getElementById('modal-pay-rem-bal').innerText = '₹0';
    document.getElementById('modal-pay-amount').value = '';

    const modal = document.getElementById('modal-receive-payment');
    if (modal) modal.style.display = 'flex';

    if (shipmentId) {
        const s = STATE.shipments.find(item => item.id === shipmentId);
        if (s) {
            const clientSelect = document.getElementById('modal-pay-client-select');
            if (clientSelect) {
                clientSelect.value = s.client_id;
                handlePaymentModalClientChange(clientSelect);
            }
            const shpSelect = document.getElementById('modal-pay-shipment-select');
            if (shpSelect) {
                shpSelect.value = s.id;
                handlePaymentModalShipmentChange(shpSelect);
            }
        }
    }
}

function handlePaymentModalClientChange(el) {
    const clientId = el.value;
    const shpSelect = document.getElementById('modal-pay-shipment-select');
    if (!shpSelect) return;

    const filtered = STATE.shipments.filter(s => s.client_id === clientId || !clientId);
    shpSelect.innerHTML = '<option value="">-- Select Shipment Invoice --</option>' + 
        filtered.map(s => {
            const sale = parseFloat(s.sale_amount) || 0;
            const rec = parseFloat(s.received_amount) || 0;
            const bal = Math.max(0, sale - rec);
            return `<option value="${s.id}">${s.id} (Bal: ₹${bal.toLocaleString('en-IN')})</option>`;
        }).join('');
}

function handlePaymentModalShipmentChange(el) {
    const shpId = el.value;
    const s = STATE.shipments.find(item => item.id === shpId);
    if (s) {
        const saleAmt = parseFloat(s.sale_amount) || 0;
        const recAmt = parseFloat(s.received_amount) || 0;
        const balAmt = Math.max(0, saleAmt - recAmt);

        document.getElementById('modal-pay-inv-total').innerText = '₹' + saleAmt.toLocaleString('en-IN');
        document.getElementById('modal-pay-prev-rec').innerText = '₹' + recAmt.toLocaleString('en-IN');
        document.getElementById('modal-pay-rem-bal').innerText = '₹' + balAmt.toLocaleString('en-IN');
        document.getElementById('modal-pay-amount').value = balAmt;
    }
}

async function handleSaveCustomerPayment(e) {
    e.preventDefault();

    const shpId = document.getElementById('modal-pay-shipment-select').value;
    const amount = parseFloat(document.getElementById('modal-pay-amount').value);

    const payload = {
        shipment_id: shpId,
        payment_date: document.getElementById('modal-pay-date').value,
        amount,
        payment_mode: document.getElementById('modal-pay-mode').value,
        bank: document.getElementById('modal-pay-bank').value,
        utr: document.getElementById('modal-pay-utr').value
    };

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/payments`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Payment error', 'error');
            return;
        }

        showToast(data.message || 'Customer Payment recorded!', 'success');
        closeModal('modal-receive-payment');
        fetchShipmentsData();
        fetchPaymentsReceivedData();
    } catch (err) {
        showToast('Payment connection error', 'error');
    }
}

function openVendorPaymentModal() {
    const shpSelect = document.getElementById('modal-vp-shipment-select');
    if (shpSelect) {
        shpSelect.innerHTML = '<option value="">-- Select Shipment --</option>' + 
            STATE.shipments.map(s => `<option value="${s.id}">${s.id} (${s.company_name})</option>`).join('');
    }
    populateVendorDropdowns();
    document.getElementById('modal-vp-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-vendor-payment').style.display = 'flex';
}

async function handleSaveVendorPayment(e) {
    e.preventDefault();

    const payload = {
        shipment_id: document.getElementById('modal-vp-shipment-select').value,
        vendor_id: document.getElementById('modal-vp-vendor-select').value,
        vendor_name: document.getElementById('modal-vp-vendor-select').options[document.getElementById('modal-vp-vendor-select').selectedIndex]?.text.split('(')[0].trim(),
        amount: parseFloat(document.getElementById('modal-vp-amount').value),
        payment_date: document.getElementById('modal-vp-date').value,
        payment_mode: document.getElementById('modal-vp-mode').value,
        reference_no: document.getElementById('modal-vp-ref').value
    };

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/vendor-payments`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Vendor Payment error', 'error');
            return;
        }

        showToast(data.message || 'Vendor Payment recorded!', 'success');
        closeModal('modal-vendor-payment');
        fetchVendorPaymentsData();
        fetchShipmentsData();
    } catch (err) {
        showToast('Vendor payment connection error', 'error');
    }
}

async function deleteVendorPayment(vpId) {
    if (!confirm('Are you sure you want to delete this vendor payment record?')) return;

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/vendor-payments/${vpId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast('Vendor Payment deleted and balance recalculated.', 'success');
            fetchVendorPaymentsData();
            fetchShipmentsData();
        } else {
            showToast(data.message || 'Delete error', 'error');
        }
    } catch (e) {}
}

function openClientModal() {
    document.getElementById('modal-client').style.display = 'flex';
}

async function handleSaveClient(e) {
    e.preventDefault();

    const payload = {
        name: document.getElementById('modal-client-name').value,
        contact_person: document.getElementById('modal-client-contact').value,
        mobile: document.getElementById('modal-client-mobile').value,
        gstin: document.getElementById('modal-client-gstin').value,
        credit_terms: document.getElementById('modal-client-credit').value
    };

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/clients`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Client save error', 'error');
            return;
        }

        showToast(data.message || 'Client created successfully!', 'success');
        closeModal('modal-client');
        fetchClientsData();
    } catch (e) {}
}

async function toggleClientStatus(clientId, status) {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/clients/${clientId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            showToast(`Client ${clientId} status updated to ${status}`, 'info');
            fetchClientsData();
        }
    } catch (e) {}
}

function openVendorModal() {
    document.getElementById('modal-vendor').style.display = 'flex';
}

async function handleSaveVendor(e) {
    e.preventDefault();

    const payload = {
        name: document.getElementById('modal-vendor-name').value,
        vendor_type: document.getElementById('modal-vendor-type').value,
        contact_person: document.getElementById('modal-vendor-contact').value,
        mobile: document.getElementById('modal-vendor-mobile').value,
        gstin: document.getElementById('modal-vendor-gstin').value,
        bank_details: document.getElementById('modal-vendor-bank').value
    };

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/vendors`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Vendor save error', 'error');
            return;
        }

        showToast(data.message || 'Vendor created successfully!', 'success');
        closeModal('modal-vendor');
        fetchVendorsData();
    } catch (e) {}
}

async function toggleVendorStatus(vendorId, status) {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/vendors/${vendorId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            showToast(`Vendor ${vendorId} status updated to ${status}`, 'info');
            fetchVendorsData();
        }
    } catch (e) {}
}

function openServiceModal() {
    document.getElementById('modal-service').style.display = 'flex';
}

async function handleSaveService(e) {
    e.preventDefault();

    const payload = {
        service_name: document.getElementById('modal-service-name').value,
        service_type: document.getElementById('modal-service-type').value,
        default_gst_pct: parseFloat(document.getElementById('modal-service-gst').value) || 18
    };

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/services`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Service save error', 'error');
            return;
        }

        showToast(data.message || 'Service created successfully!', 'success');
        closeModal('modal-service');
        fetchServicesData();
    } catch (e) {}
}

async function deleteShipment(shpId) {
    if (!confirm(`Are you sure you want to delete shipment ${shpId}?`)) return;

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/shipments/${encodeURIComponent(shpId)}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            STATE.shipments = STATE.shipments.filter(s => s.id !== shpId);
            STATE.filteredShipments = STATE.filteredShipments.filter(s => s.id !== shpId);
            renderShipmentsTable();
            renderDashboardRecentShipments();
            recalculateKPIsFromState();
            showToast(`Shipment ${shpId} deleted successfully.`, 'success');
            fetchShipmentsData();
        } else {
            showToast(data.message || 'Delete error', 'error');
        }
    } catch (e) {
        showToast('Error deleting shipment', 'error');
    }
}

async function deleteClient(clientId) {
    if (!confirm(`Are you sure you want to delete client ${clientId}?`)) return;

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/clients/${encodeURIComponent(clientId)}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            STATE.clients = STATE.clients.filter(c => c.id !== clientId);
            renderClientsTable();
            populateClientDropdowns();
            showToast(`Client ${clientId} deleted successfully.`, 'success');
            fetchClientsData();
        } else {
            showToast(data.message || 'Delete error', 'error');
        }
    } catch (e) {
        showToast('Error deleting client', 'error');
    }
}

async function deleteVendor(vendorId) {
    if (!confirm(`Are you sure you want to delete vendor ${vendorId}?`)) return;

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/vendors/${encodeURIComponent(vendorId)}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            STATE.vendors = STATE.vendors.filter(v => v.id !== vendorId);
            renderVendorsTable();
            populateVendorDropdowns();
            showToast(`Vendor ${vendorId} deleted successfully.`, 'success');
            fetchVendorsData();
        } else {
            showToast(data.message || 'Delete error', 'error');
        }
    } catch (e) {
        showToast('Error deleting vendor', 'error');
    }
}

function handleGlobalSearch(e) {
    const rawVal = (typeof e === 'string' ? e : (e && e.target ? e.target.value : (document.getElementById('global-search-input')?.value || '')));
    const q = (rawVal || '').toLowerCase().trim();

    // 1. Filter Shipments
    if (!q) {
        STATE.filteredShipments = [...STATE.shipments];
    } else {
        STATE.filteredShipments = STATE.shipments.filter(s => 
            String(s.id || '').toLowerCase().includes(q) ||
            String(s.company_name || '').toLowerCase().includes(q) ||
            String(s.client_id || '').toLowerCase().includes(q) ||
            String(s.sb_be_no || '').toLowerCase().includes(q) ||
            String(s.line_name || '').toLowerCase().includes(q) ||
            String(s.transport_name || '').toLowerCase().includes(q)
        );
    }
    STATE.currentPage = 1;
    renderShipmentsTable();

    // 2. Filter Clients
    const filteredClients = !q ? STATE.clients : STATE.clients.filter(c => 
        String(c.id || '').toLowerCase().includes(q) ||
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.contact_person || '').toLowerCase().includes(q) ||
        String(c.mobile || '').toLowerCase().includes(q) ||
        String(c.email || '').toLowerCase().includes(q) ||
        String(c.gstin || '').toLowerCase().includes(q)
    );
    renderClientsTable(filteredClients);

    // 3. Filter Vendors
    const filteredVendors = !q ? STATE.vendors : STATE.vendors.filter(v => 
        String(v.id || '').toLowerCase().includes(q) ||
        String(v.name || '').toLowerCase().includes(q) ||
        String(v.vendor_type || '').toLowerCase().includes(q) ||
        String(v.contact_person || '').toLowerCase().includes(q) ||
        String(v.mobile || '').toLowerCase().includes(q) ||
        String(v.email || '').toLowerCase().includes(q) ||
        String(v.gstin || '').toLowerCase().includes(q)
    );
    renderVendorsTable(filteredVendors);

    // 4. Filter Services
    const filteredServices = !q ? STATE.services : STATE.services.filter(srv => 
        String(srv.id || '').toLowerCase().includes(q) ||
        String(srv.service_name || '').toLowerCase().includes(q) ||
        String(srv.service_type || '').toLowerCase().includes(q)
    );
    renderServicesTable(filteredServices);

    // 5. Filter Payments Received
    const filteredPayments = !q ? STATE.payments : STATE.payments.filter(p => 
        String(p.shipment_id || p.id || '').toLowerCase().includes(q) ||
        String(p.client_id || '').toLowerCase().includes(q) ||
        String(p.company_name || p.name || '').toLowerCase().includes(q)
    );
    renderPaymentReceivedTable(filteredPayments);

    // 6. Filter Vendor Payments
    const filteredVendorPayments = !q ? STATE.vendorPayments : STATE.vendorPayments.filter(vp => 
        String(vp.shipment_id || '').toLowerCase().includes(q) ||
        String(vp.vendor_name || '').toLowerCase().includes(q) ||
        String(vp.reference_no || '').toLowerCase().includes(q)
    );
    renderVendorPaymentsTable(filteredVendorPayments);

    // 7. Filter Profit Ledger
    renderProfitLedgerTable(STATE.filteredShipments);
}

function filterShipmentsTable() {
    const q = (document.getElementById('shipment-search-input')?.value || '').toLowerCase().trim();
    const month = document.getElementById('shipment-month-filter')?.value;
    const status = document.getElementById('shipment-status-filter')?.value;

    STATE.filteredShipments = STATE.shipments.filter(s => {
        const matchQ = !q || s.id.toLowerCase().includes(q) || s.company_name.toLowerCase().includes(q);
        const matchMonth = !month || (s.date && s.date.startsWith(month));
        const matchStatus = !status || s.sale_status === status;
        return matchQ && matchMonth && matchStatus;
    });

    STATE.currentPage = 1;
    renderShipmentsTable();
}

function resetShipmentFilters() {
    if (document.getElementById('shipment-search-input')) document.getElementById('shipment-search-input').value = '';
    if (document.getElementById('shipment-month-filter')) document.getElementById('shipment-month-filter').value = '';
    if (document.getElementById('shipment-status-filter')) document.getElementById('shipment-status-filter').value = '';
    STATE.filteredShipments = [...STATE.shipments];
    STATE.currentPage = 1;
    renderShipmentsTable();
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-sidebar-overlay');
    if (sidebar) {
        sidebar.classList.toggle('open');
        if (overlay) {
            if (sidebar.classList.contains('open')) {
                overlay.style.display = 'block';
            } else {
                overlay.style.display = 'none';
            }
        }
    }
}

function exportTableToCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;

    let csv = [];
    const rows = table.querySelectorAll('tr');

    for (let i = 0; i < rows.length; i++) {
        const row = [], cols = rows[i].querySelectorAll('td, th');
        for (let j = 0; j < cols.length; j++) {
            row.push('"' + cols[j].innerText.replace(/"/g, '""') + '"');
        }
        csv.push(row.join(','));
    }

    const csvFile = new Blob([csv.join('\n')], { type: 'text/csv' });
    const downloadLink = document.createElement('a');
    downloadLink.download = `${filename}.csv`;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
}

function showToast(message, type = 'info') {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: type === 'error' ? 'error' : (type === 'success' ? 'success' : 'info'),
        title: message,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
}
