/* ==========================================================================
   AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP ENGINE (JS)
   Classic Corporate Accounting ERP Architecture v10.1.0
   ========================================================================== */

const STATE = {
    currentUser: null,
    adminUsers: [
        { id: "dir_1", name: "KHUSHAL VASOYA", role: "CEO & Founder", email: "khushal@akashalogitrans.com", phone: "9328227962", pin: "7776", avatar: "https://akashalogitrans.com/khushal.png" },
        { id: "dir_2", name: "DHRUV THESHIYA", role: "Director - Rates & Procurement", email: "dhruv@akashalogitrans.com", phone: "8155068853", pin: "7717", avatar: "https://akashalogitrans.com/dhruv_patel.png" },
        { id: "dir_3", name: "YAGNIK SORATHIYA", role: "Director - Finance & Audit", email: "info@akashalogitrans.com", phone: "9924929129", pin: "8866", avatar: "https://akashalogitrans.com/yagnik.jpeg" }
    ],
    clients: [],
    vendors: [],
    services: [],
    shipments: [],
    filteredShipments: [],
    payments: [],
    vendorPayments: [],
    expenses: [],
    expenseSummary: {},
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

// --- DOM INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    initERPTheme();
    const isAuthenticated = restoreUserSession();
    initNavigation();
    updateDateDisplay();

    if (isAuthenticated) {
        fetchBackendAPIData();
    }
});

// --- PASSWORD & MPIN VISIBILITY TOGGLE ---
function togglePasswordVisibility(inputId) {
    const el = document.getElementById(inputId);
    const eyeIcon = document.getElementById(`${inputId}-eye`);
    if (!el) return;

    if (el.type === 'password') {
        el.type = 'text';
        if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye-slash trail-icon';
    } else {
        el.type = 'password';
        if (eyeIcon) eyeIcon.className = 'fa-solid fa-eye trail-icon';
    }
}

// --- FORGOT / RESET MPIN SYSTEM ---
function openForgotMpinModal() {
    const currentId = document.getElementById('login-identifier')?.value || (STATE.currentUser ? STATE.currentUser.name : '');
    const setInput = document.getElementById('forgot-mpin-identifier');
    if (setInput && currentId) setInput.value = currentId;

    if (document.getElementById('forgot-mpin-last')) document.getElementById('forgot-mpin-last').value = '';
    if (document.getElementById('forgot-mpin-new')) document.getElementById('forgot-mpin-new').value = '';
    if (document.getElementById('forgot-mpin-confirm')) document.getElementById('forgot-mpin-confirm').value = '';

    const modal = document.getElementById('modal-forgot-mpin');
    if (modal) modal.style.display = 'flex';
}

async function handleForgotMpinSubmit(event) {
    if (event) event.preventDefault();
    const identifier = document.getElementById('forgot-mpin-identifier')?.value?.trim();
    const lastMpin = document.getElementById('forgot-mpin-last')?.value?.trim();
    const newMpin = document.getElementById('forgot-mpin-new')?.value?.trim();
    const confirmMpin = document.getElementById('forgot-mpin-confirm')?.value?.trim();

    if (!identifier) {
        showToast('Please enter your registered Username or Phone Number', 'warning');
        return;
    }
    if (!lastMpin || lastMpin.length !== 4) {
        showToast('Please enter your 4-digit Last (Current) MPIN', 'warning');
        return;
    }
    if (!newMpin || newMpin.length !== 4 || !/^\d{4}$/.test(newMpin)) {
        showToast('New MPIN must be exactly 4 numeric digits', 'warning');
        return;
    }
    if (newMpin !== confirmMpin) {
        showToast('New MPIN and Confirm MPIN do not match!', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/forgot-mpin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, last_mpin: lastMpin, new_mpin: newMpin })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            closeModal('modal-forgot-mpin');
            showToast(data.message || '4-Digit MPIN updated successfully!', 'success');
            
            // Pre-fill login input with new MPIN and focus
            if (document.getElementById('login-identifier')) document.getElementById('login-identifier').value = identifier;
            if (document.getElementById('login-mpin')) {
                document.getElementById('login-mpin').value = newMpin;
                document.getElementById('login-mpin').focus();
            }
        } else {
            showToast(data.message || 'Failed to update MPIN. Please check your Last MPIN.', 'danger');
        }
    } catch (e) {
        showToast('Error communicating with server: ' + e.message, 'danger');
    }
}

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
    let token = sessionStorage.getItem('akasha_erp_jwt_token') || localStorage.getItem('akasha_erp_jwt_token');
    const headers = options.headers || {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401 || response.status === 403) {
            console.warn('Session expired or unauthorized (401/403). Redirecting to login...');
            handleLogout(true);
            return response;
        }
        return response;
    } catch (err) {
        console.error('Fetch Auth Error:', err);
        throw err;
    }
}

function restoreUserSession() {
    // Purge any legacy persistent localStorage to prevent direct unauthorized access
    localStorage.removeItem('akasha_erp_jwt_token');
    localStorage.removeItem('akasha_erp_session');

    // Strict Tab/Window Session
    const token = sessionStorage.getItem('akasha_erp_jwt_token');
    const savedUser = sessionStorage.getItem('akasha_erp_session');

    let user = null;
    if (token && savedUser) {
        try {
            user = JSON.parse(savedUser);
        } catch (e) {
            console.error("Session restore error:", e);
        }
    }

    if (user && user.name && token) {
        STATE.currentUser = user;
        if (document.getElementById('login-screen')) document.getElementById('login-screen').style.display = 'none';
        if (document.getElementById('erp-shell')) document.getElementById('erp-shell').style.display = 'flex';
        updateCurrentUserInfo();
        return true;
    } else {
        // Not authenticated -> Force display of Login Screen
        STATE.currentUser = null;
        sessionStorage.removeItem('akasha_erp_jwt_token');
        sessionStorage.removeItem('akasha_erp_session');

        // Save target path to redirect after successful login
        const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
        if (currentPath !== '/' && currentPath !== '/dashboard') {
            sessionStorage.setItem('akasha_erp_redirect_url', window.location.pathname);
        }

        if (document.getElementById('login-screen')) document.getElementById('login-screen').style.display = 'flex';
        if (document.getElementById('erp-shell')) document.getElementById('erp-shell').style.display = 'none';
        return false;
    }
}

async function handleLogin(event) {
    if (event) event.preventDefault();
    const identifier = (document.getElementById('login-identifier')?.value || '').trim();
    const pin = (document.getElementById('login-mpin')?.value || '').trim();
    const rememberMe = document.getElementById('login-remember-me') ? document.getElementById('login-remember-me').checked : true;
    const errBox = document.getElementById('login-error-message');

    if (!identifier) {
        if (errBox) {
            errBox.style.display = 'block';
            errBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Username or Phone Number is required!`;
        }
        return;
    }

    if (!pin) {
        if (errBox) {
            errBox.style.display = 'block';
            errBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 4-Digit Security MPIN is required!`;
        }
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, phone: identifier, username: identifier, mpin: pin })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            if (errBox) {
                errBox.style.display = 'block';
                errBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${data.message || 'Invalid Credentials or MPIN!'}`;
            }
            return;
        }

        if (errBox) errBox.style.display = 'none';

        STATE.currentUser = data.user;
        const jwtToken = data.token;

        sessionStorage.setItem('akasha_erp_jwt_token', jwtToken);
        sessionStorage.setItem('akasha_erp_session', JSON.stringify(data.user));

        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('erp-shell').style.display = 'flex';

        updateCurrentUserInfo();

        // Redirect to intended page or /dashboard
        const targetRedirect = sessionStorage.getItem('akasha_erp_redirect_url') || '/dashboard';
        sessionStorage.removeItem('akasha_erp_redirect_url');

        navigateRoute(targetRedirect, true);
        fetchBackendAPIData();
        showToast(`Welcome back, ${data.user.name}!`, "success");
    } catch (err) {
        if (errBox) {
            errBox.style.display = 'block';
            errBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Connection error to server.`;
        }
    }
}

function handleLogout(isSessionExpired = false) {
    localStorage.removeItem('akasha_erp_jwt_token');
    localStorage.removeItem('akasha_erp_session');
    sessionStorage.removeItem('akasha_erp_jwt_token');
    sessionStorage.removeItem('akasha_erp_session');
    sessionStorage.removeItem('akasha_erp_redirect_url');
    STATE.currentUser = null;

    if (document.getElementById('login-screen')) document.getElementById('login-screen').style.display = 'flex';
    if (document.getElementById('erp-shell')) document.getElementById('erp-shell').style.display = 'none';
    if (document.getElementById('login-identifier')) document.getElementById('login-identifier').value = '';
    if (document.getElementById('login-mpin')) document.getElementById('login-mpin').value = '';

    window.history.pushState({}, '', '/');
    if (isSessionExpired) {
        showToast('Your session has expired. Please log in again.', 'warning');
    } else {
        showToast('Logged out safely.', 'info');
    }
}

function updateCurrentUserInfo() {
    if (!STATE.currentUser) return;
    const name = STATE.currentUser.name || 'khushal';
    const role = STATE.currentUser.role || 'ADMIN';
    const displayName = name.toLowerCase().split(' ')[0] || 'khushal';
    
    // Initials matching tracking portal badge (e.g. KA, YS, DT)
    let initials = 'KA';
    if (name.toUpperCase().includes('KHUSHAL')) initials = 'KA';
    else if (name.toUpperCase().includes('YAGNIK')) initials = 'YS';
    else if (name.toUpperCase().includes('DHRUV')) initials = 'DT';

    if (document.getElementById('current-user-name')) document.getElementById('current-user-name').innerText = displayName;
    if (document.getElementById('current-user-role')) document.getElementById('current-user-role').innerText = 'ADMIN';
    if (document.getElementById('topbar-user-name')) document.getElementById('topbar-user-name').innerText = displayName;
    if (document.getElementById('topbar-user-role')) document.getElementById('topbar-user-role').innerText = 'ADMIN';
    if (document.getElementById('topbar-user-avatar')) document.getElementById('topbar-user-avatar').innerText = initials;
    if (document.getElementById('sidebar-user-avatar')) document.getElementById('sidebar-user-avatar').innerText = initials;
    if (document.getElementById('dash-welcome-user')) document.getElementById('dash-welcome-user').innerText = displayName;
}

// --- ROUTING ENGINE (15 NAV ROUTES) ---
const ROUTE_MAP = {
    '/': { view: 'dashboard', path: '/dashboard', title: 'Executive Dashboard | Akasha ERP' },
    '/dashboard': { view: 'dashboard', path: '/dashboard', title: 'Executive Dashboard | Akasha ERP' },
    '/shipment-entry': { view: 'shipments', path: '/shipment-entry', title: 'Shipment Register | Akasha ERP' },
    '/sales-ledger': { view: 'sales-ledger', path: '/sales-ledger', title: 'Sales Ledger | Akasha ERP' },
    '/purchase-ledger': { view: 'purchase-ledger', path: '/purchase-ledger', title: 'Purchase Ledger | Akasha ERP' },
    '/payment-received': { view: 'payment-received', path: '/payment-received', title: 'Payment Received | Akasha ERP' },
    '/vendor-payment': { view: 'vendor-payment', path: '/vendor-payment', title: 'Vendor Payment | Akasha ERP' },
    '/expenses': { view: 'expenses', path: '/expenses', title: 'Expense Register | Akasha ERP' },
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
        const clean = pathname.replace(/\/$/, '') || '/';
        if (clean !== '/' && clean !== '/dashboard') {
            sessionStorage.setItem('akasha_erp_redirect_url', pathname);
        }
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
    if (viewId === 'sales_ledger' || viewId === 'sales-ledger') targetElId = 'view-sales-ledger';
    if (viewId === 'purchase_ledger' || viewId === 'purchase-ledger') targetElId = 'view-purchase-ledger';
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
    if (viewId === 'sales-ledger' || viewId === 'sales_ledger') renderSalesLedgerTable();
    if (viewId === 'purchase-ledger' || viewId === 'purchase_ledger') renderPurchaseLedgerTable();
    if (viewId === 'payment-received' || viewId === 'payment_received') fetchPaymentsReceivedData();
    if (viewId === 'vendor-payment' || viewId === 'vendor_payment') fetchVendorPaymentsData();
    if (viewId === 'expenses') fetchExpensesData();
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
            fetchShipmentsData(),
            fetchExpensesData()
        ]);
    } catch (err) {
        console.log("Local Database Ready.");
    }
}

function formatCurrencyINR(amount) {
    const val = parseFloat(amount) || 0;
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const formatted = absVal.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return isNegative ? `-₹${formatted}` : `₹${formatted}`;
}

async function fetchDashboardKPIs() {
    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/dashboard/kpis`);
        if (res.ok) {
            const data = await res.json();
            if (data) {
                STATE.kpis = data;
                if (document.getElementById('kpi-monthly-revenue')) document.getElementById('kpi-monthly-revenue').innerText = formatCurrencyINR(data.monthly_revenue);
                if (document.getElementById('kpi-total-purchase')) document.getElementById('kpi-total-purchase').innerText = formatCurrencyINR(data.total_purchase);
                if (document.getElementById('kpi-net-profit')) document.getElementById('kpi-net-profit').innerText = formatCurrencyINR(data.net_profit);
                if (document.getElementById('kpi-pending-payment')) document.getElementById('kpi-pending-payment').innerText = formatCurrencyINR(data.pending_payment);
                if (document.getElementById('kpi-vendor-payable')) {
                    document.getElementById('kpi-vendor-payable').innerText = formatCurrencyINR(data.vendor_payable);
                }
                if (document.getElementById('kpi-total-expense')) {
                    document.getElementById('kpi-total-expense').innerText = formatCurrencyINR(data.total_expense || 0);
                }
                if (document.getElementById('kpi-expense-fy-label') && data.fy_label) {
                    document.getElementById('kpi-expense-fy-label').innerText = data.fy_label;
                }
                const margin = data.monthly_revenue > 0 ? ((data.net_profit / data.monthly_revenue) * 100).toFixed(2) : "0.00";
                if (document.getElementById('kpi-margin-pct')) {
                    document.getElementById('kpi-margin-pct').innerText = `${margin}%`;
                }
            }
        }
    } catch (e) {
        recalculateKPIsFromState();
    }
    renderDashboardRecentShipments();
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

    if (document.getElementById('kpi-monthly-revenue')) document.getElementById('kpi-monthly-revenue').innerText = formatCurrencyINR(rev);
    if (document.getElementById('kpi-total-purchase')) document.getElementById('kpi-total-purchase').innerText = formatCurrencyINR(pur);
    if (document.getElementById('kpi-net-profit')) document.getElementById('kpi-net-profit').innerText = formatCurrencyINR(pft);
    if (document.getElementById('kpi-pending-payment')) document.getElementById('kpi-pending-payment').innerText = formatCurrencyINR(pend);
    if (document.getElementById('kpi-vendor-payable')) document.getElementById('kpi-vendor-payable').innerText = formatCurrencyINR(vPay);
    if (document.getElementById('kpi-total-expense')) document.getElementById('kpi-total-expense').innerText = formatCurrencyINR(pur);
    
    const margin = rev > 0 ? ((pft / rev) * 100).toFixed(2) : "0.00";
    if (document.getElementById('kpi-margin-pct')) document.getElementById('kpi-margin-pct').innerText = `${margin}%`;

    renderDashboardRecentShipments();
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
                renderSalesLedgerTable();
                renderPurchaseLedgerTable();
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

async function fetchExpensesData() {
    try {
        const [sumRes, allRes] = await Promise.all([
            fetchWithAuth(`${API_BASE_URL}/expenses/summary`),
            fetchWithAuth(`${API_BASE_URL}/expenses`)
        ]);

        if (sumRes.ok && allRes.ok) {
            const sumData = await sumRes.json();
            const allData = await allRes.json();
            STATE.expenses = allData || [];
            STATE.expenseSummary = sumData || {};

            if (document.getElementById('exp-kpi-fy-total')) {
                document.getElementById('exp-kpi-fy-total').innerText = formatCurrencyINR(sumData.total_expense_fy || 0);
            }
            if (document.getElementById('exp-kpi-fy-sub')) {
                document.getElementById('exp-kpi-fy-sub').innerText = `${sumData.fy_label || 'FY 2026-27'} Approved Expenses`;
            }
            if (document.getElementById('exp-kpi-total-count')) {
                document.getElementById('exp-kpi-total-count').innerText = `${(allData || []).length} Entries`;
            }

            const now = new Date();
            const curMonthKey = now.toISOString().substring(0, 7);
            const curMonthObj = (sumData.months || []).find(m => m.month_key === curMonthKey);
            if (document.getElementById('exp-kpi-cur-month')) {
                document.getElementById('exp-kpi-cur-month').innerText = formatCurrencyINR(curMonthObj ? curMonthObj.total_amount : 0);
            }

            renderExpensesAccordion(sumData);
        }
    } catch (e) {
        console.error('Fetch Expenses Error:', e);
    }
}

function renderExpensesAccordion(summaryData) {
    const container = document.getElementById('expenses-month-accordion-container');
    if (!container) return;

    const months = summaryData?.months || [];
    if (months.length === 0) {
        container.innerHTML = `
            <div class="panel-card" style="padding: 40px; text-align: center; color: #64748b;">
                <i class="fa-solid fa-receipt" style="font-size: 32px; color: #cbd5e1; margin-bottom: 12px; display: block;"></i>
                <div style="font-weight: 700; font-size: 15px; color: #1c2024;">No Expenses Recorded Yet</div>
                <p style="font-size: 13px; margin-top: 4px;">Click <strong>+ Record Expense</strong> above to log your first company expenditure.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = months.map((m, idx) => {
        const isLatest = idx === 0;
        const mKey = m.month_key;

        return `
            <div class="panel-card" id="expense-month-card-${mKey}" style="overflow: hidden; border: 1px solid #e5e2da; margin-bottom: 12px;">
                <!-- Month Accordion Header Bar -->
                <div onclick="toggleExpenseMonth('${mKey}')" style="background: #fbfaf7; border-bottom: ${isLatest ? '1px solid #e5e2da' : 'none'}; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i id="expense-month-icon-${mKey}" class="fa-solid ${isLatest ? 'fa-circle-minus' : 'fa-circle-plus'}" style="font-size: 18px; color: ${isLatest ? '#c83228' : '#2563eb'};"></i>
                        <div>
                            <span style="font-size: 15px; font-weight: 800; color: #1c2024;"><i class="fa-solid fa-calendar-days" style="color: #64748b; margin-right: 6px;"></i> ${m.month_label}</span>
                            <span style="font-size: 12px; color: #64748b; margin-left: 8px;">(${m.count} ${m.count === 1 ? 'Transaction' : 'Transactions'})</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div style="text-align: right;">
                            <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Month Total:</span>
                            <strong style="font-size: 15px; color: #c83228; margin-left: 6px; font-weight: 900;">${formatCurrencyINR(m.total_amount)}</strong>
                        </div>
                        <span class="btn-action" style="padding: 4px 8px; font-size: 11px; background: #ffffff; border-radius: 4px;"><i class="fa-solid fa-chevron-down" id="expense-month-arrow-${mKey}" style="transform: ${isLatest ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.2s ease;"></i></span>
                    </div>
                </div>

                <!-- Detailed Month Expenses Table (Hidden until expanded) -->
                <div id="expense-month-body-${mKey}" style="display: ${isLatest ? 'block' : 'none'}; padding: 0;">
                    <div class="table-container">
                        <table class="erp-table">
                            <thead>
                                <tr>
                                    <th style="width: 80px;">Expense ID</th>
                                    <th style="width: 90px;">Date</th>
                                    <th style="width: 15%;">Category</th>
                                    <th style="width: 20%;">Paid To / Beneficiary</th>
                                    <th style="width: 25%;">Purpose / Description</th>
                                    <th style="width: 12%;">Mode</th>
                                    <th style="width: 14%; text-align: right;">Amount (₹)</th>
                                    <th class="action-col" style="width: 75px; text-align: right;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${m.expenses.map(e => `
                                    <tr>
                                        <td><strong style="color: var(--primary); font-size: 12px;">${e.id}</strong></td>
                                        <td>${e.expense_date}</td>
                                        <td><span class="status-pill status-partial" style="font-size: 10.5px;">${e.category}</span></td>
                                        <td style="white-space: normal; word-break: break-word;"><strong style="color: #1c2024;">${e.paid_to}</strong></td>
                                        <td style="white-space: normal; word-break: break-word; color: #475569;">${e.purpose || '-'}${e.reference_no ? ` <small style="color: #94a3b8;">(Ref: ${e.reference_no})</small>` : ''}</td>
                                        <td><span style="font-size: 11px; font-weight: 600; color: #334155;">${e.payment_mode || 'Bank Transfer'}</span></td>
                                        <td style="text-align: right; font-weight: 900; color: #c83228; font-size: 13px;">${formatCurrencyINR(e.amount)}</td>
                                        <td class="action-cell">
                                            <button type="button" class="btn-icon-action btn-icon-edit" onclick="openExpenseModal('${e.id}')" title="Edit Expense"><i class="fa-solid fa-pen-to-square"></i></button>
                                            <button type="button" class="btn-icon-action btn-icon-delete" onclick="deleteExpense('${e.id}')" title="Delete Expense"><i class="fa-solid fa-trash"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleExpenseMonth(mKey) {
    const card = document.getElementById(`expense-month-card-${mKey}`);
    const body = document.getElementById(`expense-month-body-${mKey}`);
    const icon = document.getElementById(`expense-month-icon-${mKey}`);
    const arrow = document.getElementById(`expense-month-arrow-${mKey}`);
    if (!body) return;

    const isClosed = body.style.display === 'none';
    body.style.display = isClosed ? 'block' : 'none';
    if (icon) {
        icon.className = `fa-solid ${isClosed ? 'fa-circle-minus' : 'fa-circle-plus'}`;
        icon.style.color = isClosed ? '#c83228' : '#2563eb';
    }
    if (arrow) {
        arrow.style.transform = isClosed ? 'rotate(180deg)' : 'rotate(0deg)';
    }
}

function openExpenseModal(expenseId = null) {
    const modal = document.getElementById('modal-expense');
    if (!modal) return;
    const form = document.getElementById('form-expense');
    if (form) form.reset();

    const titleEl = document.getElementById('modal-expense-title');
    const isEditEl = document.getElementById('modal-expense-is-edit');
    const idEl = document.getElementById('modal-expense-id');

    if (expenseId) {
        const exp = (STATE.expenses || []).find(e => e.id === expenseId);
        if (exp) {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: #2563eb; margin-right: 8px;"></i> Edit Expense (${exp.id})`;
            if (isEditEl) isEditEl.value = 'true';
            if (idEl) idEl.value = exp.id;

            if (document.getElementById('modal-exp-date')) document.getElementById('modal-exp-date').value = exp.expense_date ? exp.expense_date.substring(0, 10) : '';
            if (document.getElementById('modal-exp-category')) document.getElementById('modal-exp-category').value = exp.category || 'General Expense';
            if (document.getElementById('modal-exp-paid-to')) document.getElementById('modal-exp-paid-to').value = exp.paid_to || '';
            if (document.getElementById('modal-exp-amount')) document.getElementById('modal-exp-amount').value = exp.amount || '';
            if (document.getElementById('modal-exp-mode')) document.getElementById('modal-exp-mode').value = exp.payment_mode || 'Bank Transfer';
            if (document.getElementById('modal-exp-ref')) document.getElementById('modal-exp-ref').value = exp.reference_no || '';
            if (document.getElementById('modal-exp-purpose')) document.getElementById('modal-exp-purpose').value = exp.purpose || '';
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-receipt" style="color: #c83228; margin-right: 8px;"></i> Record New Expense`;
        if (isEditEl) isEditEl.value = 'false';
        if (idEl) idEl.value = '';
        if (document.getElementById('modal-exp-date')) document.getElementById('modal-exp-date').value = new Date().toISOString().split('T')[0];
    }

    modal.style.display = 'flex';
}

async function handleSaveExpense(e) {
    if (e) e.preventDefault();

    const isEdit = document.getElementById('modal-expense-is-edit')?.value === 'true';
    const expenseId = (document.getElementById('modal-expense-id')?.value || '').trim();
    const expenseDate = document.getElementById('modal-exp-date')?.value;
    const category = (document.getElementById('modal-exp-category')?.value || '').trim();
    const paidTo = (document.getElementById('modal-exp-paid-to')?.value || '').trim();
    const amount = parseFloat(document.getElementById('modal-exp-amount')?.value) || 0;
    const paymentMode = document.getElementById('modal-exp-mode')?.value || 'Bank Transfer';
    const refNo = (document.getElementById('modal-exp-ref')?.value || '').trim();
    const purpose = (document.getElementById('modal-exp-purpose')?.value || '').trim();

    if (!expenseDate) {
        showToast('Please specify the Expense Incurred Date.', 'warning');
        return;
    }
    if (!category) {
        showToast('Please select or specify an Expense Category (e.g. Office Rent, Payroll).', 'warning');
        return;
    }
    if (!paidTo) {
        showToast('Please enter the Payee / Vendor name (Paid To).', 'warning');
        return;
    }
    if (amount <= 0 || isNaN(amount)) {
        showToast('Please enter a valid positive expense amount.', 'warning');
        return;
    }

    const payload = {
        expense_date: expenseDate,
        category,
        paid_to: paidTo,
        amount,
        payment_mode: paymentMode,
        reference_no: refNo,
        purpose
    };

    try {
        const url = isEdit ? `${API_BASE_URL}/expenses/${encodeURIComponent(expenseId)}` : `${API_BASE_URL}/expenses`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetchWithAuth(url, {
            method,
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Error recording operational expense.', 'error');
            return;
        }

        showToast(isEdit ? `Expense ${expenseId} updated successfully!` : `Expense voucher of ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} recorded!`, 'success');
        closeModal('modal-expense');
        await fetchExpensesData();
        fetchDashboardKPIs();
    } catch (err) {
        showToast('Network error while saving expense voucher.', 'error');
    }
}

async function deleteExpense(expenseId) {
    if (!confirm(`Are you sure you want to delete Expense ${expenseId}?`)) return;

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/expenses/${encodeURIComponent(expenseId)}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(`Expense ${expenseId} deleted.`, 'success');
            await fetchExpensesData();
            fetchDashboardKPIs();
        } else {
            showToast(data.message || 'Delete error', 'error');
        }
    } catch (err) {
        showToast('Error deleting expense', 'error');
    }
}

function filterExpenses() {
    const q = (document.getElementById('expense-search-input')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('expense-category-filter')?.value;

    let filtered = [...(STATE.expenses || [])];
    if (q) {
        filtered = filtered.filter(e => 
            String(e.id || '').toLowerCase().includes(q) ||
            String(e.category || '').toLowerCase().includes(q) ||
            String(e.paid_to || '').toLowerCase().includes(q) ||
            String(e.purpose || '').toLowerCase().includes(q)
        );
    }
    if (cat) {
        filtered = filtered.filter(e => e.category === cat);
    }

    const monthGroups = {};
    filtered.forEach(e => {
        const mKey = (e.expense_date || '').substring(0, 7);
        if (mKey) {
            if (!monthGroups[mKey]) {
                monthGroups[mKey] = {
                    month_key: mKey,
                    month_label: new Date(mKey + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
                    total_amount: 0,
                    count: 0,
                    expenses: []
                };
            }
            monthGroups[mKey].total_amount += parseFloat(e.amount) || 0;
            monthGroups[mKey].count += 1;
            monthGroups[mKey].expenses.push(e);
        }
    });

    renderExpensesAccordion({ months: Object.values(monthGroups) });
}

function resetExpenseFilters() {
    if (document.getElementById('expense-search-input')) document.getElementById('expense-search-input').value = '';
    if (document.getElementById('expense-category-filter')) document.getElementById('expense-category-filter').value = '';
    renderExpensesAccordion(STATE.expenseSummary);
}

// --- VIEW RENDERERS ---
function renderDashboardRecentShipments() {
    const tbody = document.getElementById('dash-recent-shipments-body');
    if (!tbody) return;

    const list = STATE.shipments.slice(0, 8);
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 25px; color: var(--text-muted); font-weight: 600;">No Recent Shipments Recorded</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(s => {
        const saleAmt = parseFloat(s.sale_amount) || 0;
        const purAmt = parseFloat(s.purchase_amount) || 0;
        const recAmt = Math.min(saleAmt, Math.max(0, parseFloat(s.received_amount) || 0));
        const profit = saleAmt - purAmt;
        const margin = saleAmt > 0 ? ((profit / saleAmt) * 100).toFixed(1) : (purAmt > 0 ? "-100.0" : "0.0");
        const marginNum = parseFloat(margin);
        
        const custStatus = s.sale_status || (recAmt >= saleAmt && saleAmt > 0 ? 'PAID' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID'));
        const vendStatus = s.purchase_status || 'UNPAID';

        let custBadge = 'status-unpaid';
        if (custStatus === 'PAID') custBadge = 'status-paid';
        else if (custStatus === 'PARTIAL') custBadge = 'status-partial';

        let vendBadge = 'status-unpaid';
        if (vendStatus === 'PAID') vendBadge = 'status-paid';
        else if (vendStatus === 'PARTIAL') vendBadge = 'status-partial';

        const isPositive = profit > 0;
        const isNegative = profit < 0;
        const profitColor = isNegative ? 'var(--danger)' : (isPositive ? 'var(--success)' : '#64748b');
        const marginColor = marginNum < 0 ? 'var(--danger)' : (marginNum > 0 ? 'var(--success)' : '#64748b');
        const formattedProfit = (profit < 0 ? '-₹' : '₹') + Math.abs(profit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return `
            <tr>
                <td class="col-id" data-label="Shipment ID"><strong style="color: var(--neon-blue); font-weight: 800;">${s.id}</strong></td>
                <td class="col-client" data-label="Client / Importer"><strong>${s.company_name}</strong></td>
                <td class="col-sales" data-label="Sales Value" style="text-align: right;"><strong style="color: var(--neon-blue); font-weight: 800;">${formatCurrencyINR(saleAmt)}</strong></td>
                <td class="col-purchase" data-label="Purchase Cost" style="text-align: right;"><strong style="color: var(--brand-red); font-weight: 800;">${formatCurrencyINR(purAmt)}</strong></td>
                <td class="col-profit" data-label="Net Profit" style="text-align: right;"><strong style="color: ${profitColor}; font-weight: 800;">${formattedProfit}</strong></td>
                <td class="col-margin" data-label="Profit Margin" style="text-align: right;"><strong style="color: ${marginColor}; font-weight: 800;">${marginNum > 0 ? '+' : ''}${margin}%</strong></td>
                <td class="col-cust-status" data-label="Customer Status" style="text-align: center;"><span class="status-pill ${custBadge}">${custStatus}</span></td>
                <td class="col-vend-status" data-label="Vendor Status" style="text-align: center;"><span class="status-pill ${vendBadge}">${vendStatus}</span></td>
                <td class="action-cell" style="text-align: right;">
                    <button type="button" class="btn-icon-action btn-icon-edit" onclick="navigateRoute('/shipment-entry/edit/${encodeURIComponent(s.id)}')" title="View / Edit Job"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button type="button" class="btn-icon-action btn-icon-delete" onclick="deleteShipment('${s.id}')" title="Delete Shipment"><i class="fa-solid fa-trash"></i></button>
                </td>
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
        const marginPct = saleAmt > 0 ? ((netProfit / saleAmt) * 100).toFixed(1) : (purAmt > 0 ? "-100.0" : "0.0");
        const isLoss = netProfit < 0;
        const formattedNet = (netProfit < 0 ? '-₹' : '₹') + Math.abs(netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        const custStatus = s.sale_status || (recAmt >= saleAmt && saleAmt > 0 ? 'PAID' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID'));
        let badgeClass = 'status-unpaid';
        if (custStatus === 'PAID') badgeClass = 'status-paid';
        else if (custStatus === 'PARTIAL') badgeClass = 'status-partial';

        return `
            <tr class="shipment-main-row" id="main-row-${safeId}">
                <td class="col-expand" style="text-align: center; white-space: nowrap;">
                    <button type="button" onclick="toggleShipmentRowExpand('${s.id}')" style="background: none; border: none; cursor: pointer;">
                        <i id="expand-icon-${safeId}" class="fa-solid fa-circle-plus" style="font-size: 16px; color: var(--neon-blue);"></i>
                    </button>
                </td>
                <td class="col-id" data-label="Shipment ID"><strong style="color: var(--neon-blue); font-size: 13px; font-weight: 800;">${s.id}</strong></td>
                <td class="col-date" data-label="Date"><span>${s.date}</span></td>
                <td class="col-client" data-label="Client / Company"><strong>${s.company_name}</strong></td>
                <td class="col-purchase" data-label="Purchase Cost" style="text-align: right;"><strong style="font-size: 13px; color: var(--brand-red);">${formatCurrencyINR(purAmt)}</strong></td>
                <td class="col-sales" data-label="Sales Value" style="text-align: right;"><strong style="font-size: 13px; color: var(--neon-blue);">${formatCurrencyINR(saleAmt)}</strong></td>
                <td class="action-cell">
                    <button type="button" class="btn-icon-action btn-icon-edit" onclick="navigateRoute('/shipment-entry/edit/${encodeURIComponent(s.id)}')" title="Edit Shipment"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button type="button" class="btn-icon-action btn-icon-delete" onclick="deleteShipment('${s.id}')" title="Delete Shipment"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>

            <tr id="sub-row-${safeId}" class="shipment-detail-subrow" style="display: none; background: #f8fafc;">
                <td colspan="7" style="padding: 12px 16px; border-bottom: 2px solid #cbd5e1;">
                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 14px 18px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                            <strong style="font-size: 15px; color: #0f172a;"><i class="fa-solid fa-boxes-packing"></i> Shipment Overview (${s.id})</strong>
                            <span class="status-pill ${badgeClass}">${custStatus}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; font-size: 13px;">
                            <div><strong>Booking Date:</strong> ${s.date}</div>
                            <div><strong>Client Account:</strong> ${s.client_id || 'N/A'} (${s.company_name})</div>
                            <div><strong>Shipping Line:</strong> ${s.line_name || 'N/A'}</div>
                            <div><strong>Transporter:</strong> ${s.transport_name || 'N/A'}</div>
                            <div><strong>SB/BE Number:</strong> ${s.sb_be_no || 'N/A'}</div>
                            <div><strong>Shipment Type:</strong> ${s.shipment_type || 'Export'}</div>
                            <div><strong>Taxable Purchase:</strong> ${formatCurrencyINR(purAmt)}</div>
                            <div><strong>Taxable Sales:</strong> ${formatCurrencyINR(saleAmt)}</div>
                            <div><strong>Customer Received:</strong> ${formatCurrencyINR(recAmt)}</div>
                            <div><strong>Customer Outstanding:</strong> ${formatCurrencyINR(remBal)}</div>
                            <div style="grid-column: span 2; background: ${isLoss ? '#fef2f2' : '#ecfdf5'}; padding: 8px 12px; border-radius: 4px; border: 1px solid ${isLoss ? '#fecaca' : '#a7f3d0'};">
                                <strong style="color: ${isLoss ? '#b91c1c' : '#065f46'};">Net Operating Profit: ${formattedNet} (Margin: ${parseFloat(marginPct) > 0 ? '+' : ''}${marginPct}%)</strong>
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

// --- SALES LEDGER ENGINE (Dedicated Customer Invoicing & Receivables Flow) ---
function renderSalesLedgerTable(customList = null) {
    const tbody = document.getElementById('table-sales-ledger-body');
    if (!tbody) return;

    const list = customList !== null ? customList : (STATE.shipments || []);

    // Compute Summary KPIs
    let totalSales = 0;
    let totalReceived = 0;
    list.forEach(s => {
        const sale = parseFloat(s.sale_amount) || 0;
        const rec = parseFloat(s.received_amount) || 0;
        totalSales += sale;
        totalReceived += rec;
    });
    const balanceRec = Math.max(0, totalSales - totalReceived);

    if (document.getElementById('sales-kpi-total-sales')) {
        document.getElementById('sales-kpi-total-sales').innerText = formatCurrencyINR(totalSales);
    }
    if (document.getElementById('sales-kpi-total-received')) {
        document.getElementById('sales-kpi-total-received').innerText = formatCurrencyINR(totalReceived);
    }
    if (document.getElementById('sales-kpi-balance-rec')) {
        document.getElementById('sales-kpi-balance-rec').innerText = formatCurrencyINR(balanceRec);
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-file-invoice-dollar" style="font-size: 24px; margin-bottom: 8px; display: block;"></i> No Sales Invoices Found.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(s => {
        const safeId = String(s.id).replace(/[^a-zA-Z0-9]/g, '_');
        const saleAmt = parseFloat(s.sale_amount) || 0;
        const recAmt = Math.min(saleAmt, Math.max(0, parseFloat(s.received_amount) || 0));
        const remBal = Math.max(0, saleAmt - recAmt);
        const custStatus = s.sale_status || (recAmt >= saleAmt && saleAmt > 0 ? 'PAID' : (recAmt > 0 ? 'PARTIAL' : 'UNPAID'));

        let badgeClass = 'status-unpaid';
        if (custStatus === 'PAID') badgeClass = 'status-paid';
        else if (custStatus === 'PARTIAL') badgeClass = 'status-partial';

        let saleItems = [];
        try {
            saleItems = typeof s.sale_items === 'string' ? JSON.parse(s.sale_items) : (s.sale_items || []);
        } catch (e) { saleItems = []; }

        const itemsHtml = saleItems.length > 0 ? `
            <table class="erp-table" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; margin-top: 8px; font-size: 11.5px;">
                <thead>
                    <tr style="background: #eff6ff; color: #1e3a8a;">
                        <th style="padding: 5px 8px;">Service Item</th>
                        <th style="padding: 5px 8px; text-align: center;">Qty</th>
                        <th style="padding: 5px 8px; text-align: right;">Rate (₹)</th>
                        <th style="padding: 5px 8px; text-align: center;">Currency</th>
                        <th style="padding: 5px 8px; text-align: center;">GST %</th>
                        <th style="padding: 5px 8px; text-align: right;">Total Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${saleItems.map(it => `
                        <tr>
                            <td style="padding: 5px 8px; font-weight: 700;">${it.service_name || '-'}</td>
                            <td style="padding: 5px 8px; text-align: center;">${it.qty || 1}</td>
                            <td style="padding: 5px 8px; text-align: right;">${(parseFloat(it.rate) || 0).toLocaleString('en-IN')}</td>
                            <td style="padding: 5px 8px; text-align: center;">${it.currency || 'INR'}</td>
                            <td style="padding: 5px 8px; text-align: center;">${it.gst_pct || 18}%</td>
                            <td style="padding: 5px 8px; text-align: right; font-weight: 800; color: #1e40af;">${formatCurrencyINR(it.amount || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : `<div style="font-size: 12px; color: #64748b; font-style: italic; margin-top: 6px;">No item breakdown available.</div>`;

        return `
            <tr class="shipment-main-row" id="sales-row-${safeId}">
                <td class="col-expand" style="text-align: center; white-space: nowrap;">
                    <button type="button" onclick="toggleSalesLedgerRowExpand('${safeId}')" style="background: none; border: none; cursor: pointer;">
                        <i id="sales-expand-icon-${safeId}" class="fa-solid fa-circle-plus" style="font-size: 16px; color: var(--neon-blue);"></i>
                    </button>
                </td>
                <td class="col-id" data-label="Shipment ID"><strong style="color: var(--neon-blue); font-size: 13px; font-weight: 800;">${s.id}</strong></td>
                <td class="col-date" data-label="Invoice Date"><span>${s.date}</span></td>
                <td class="col-client" data-label="Client / Importer"><strong>${s.company_name}</strong> <small style="color: var(--text-muted);">(${s.client_id || 'N/A'})</small></td>
                <td class="col-sales" data-label="Total Invoiced" style="text-align: right;"><strong style="font-size: 13px; color: var(--neon-blue);">${formatCurrencyINR(saleAmt)}</strong></td>
                <td class="col-received" data-label="Collected" style="text-align: right;"><strong style="font-size: 13px; color: var(--neon-green);">${formatCurrencyINR(recAmt)}</strong></td>
                <td class="col-balance" data-label="Balance Due" style="text-align: right;"><strong style="font-size: 13px; color: ${remBal > 0 ? 'var(--neon-amber)' : 'var(--neon-green)'};">${formatCurrencyINR(remBal)}</strong></td>
                <td class="col-status" data-label="Status" style="text-align: center;"><span class="status-pill ${badgeClass}">${custStatus}</span></td>
                <td class="action-cell">
                    <button type="button" class="btn-icon-action btn-icon-edit" onclick="navigateRoute('/shipment-entry/edit/${encodeURIComponent(s.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button type="button" class="btn-icon-action btn-icon-delete" onclick="deleteShipment('${s.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    <button type="button" class="btn-action" onclick="openReceivePaymentModal('${s.id}')" style="background: var(--neon-green-bg); color: var(--neon-green); border-color: var(--neon-green-border); font-weight: 700;" title="Receive Payment for ${s.id}"><i class="fa-solid fa-hand-holding-dollar"></i> Receive Payment</button>
                </td>
            </tr>
            <tr id="sales-sub-row-${safeId}" style="display: none; background: #f8fafc;">
                <td colspan="9" style="padding: 12px 18px; border-bottom: 2px solid #cbd5e1;">
                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                            <strong style="font-size: 13px; color: #1e3a8a;"><i class="fa-solid fa-list-check"></i> Customer Sales Breakdown & Services (${s.id})</strong>
                            <span style="font-size: 12px; color: #64748b;">Shipping Line: <strong>${s.line_name || 'N/A'}</strong> | Transport: <strong>${s.transport_name || 'N/A'}</strong></span>
                        </div>
                        ${itemsHtml}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function toggleSalesLedgerRowExpand(safeId) {
    const sub = document.getElementById(`sales-sub-row-${safeId}`);
    const icon = document.getElementById(`sales-expand-icon-${safeId}`);
    if (!sub) return;
    const isClosed = sub.style.display === 'none' || !sub.style.display;
    sub.style.display = isClosed ? 'table-row' : 'none';
    if (icon) {
        icon.className = `fa-solid ${isClosed ? 'fa-circle-minus' : 'fa-circle-plus'}`;
        icon.style.color = isClosed ? '#dc2626' : '#2563eb';
    }
}

function filterSalesLedger() {
    const q = (document.getElementById('sales-search-input')?.value || '').toLowerCase().trim();
    const month = document.getElementById('sales-month-filter')?.value;
    const status = document.getElementById('sales-status-filter')?.value;

    let filtered = [...(STATE.shipments || [])];
    if (q) {
        filtered = filtered.filter(s =>
            String(s.id || '').toLowerCase().includes(q) ||
            String(s.client_id || '').toLowerCase().includes(q) ||
            String(s.company_name || '').toLowerCase().includes(q)
        );
    }
    if (month) {
        filtered = filtered.filter(s => (s.date || '').startsWith(month));
    }
    if (status) {
        filtered = filtered.filter(s => {
            const sale = parseFloat(s.sale_amount) || 0;
            const rec = parseFloat(s.received_amount) || 0;
            const custStatus = s.sale_status || (rec >= sale && sale > 0 ? 'PAID' : (rec > 0 ? 'PARTIAL' : 'UNPAID'));
            return custStatus === status;
        });
    }
    renderSalesLedgerTable(filtered);
}

function resetSalesLedgerFilters() {
    if (document.getElementById('sales-search-input')) document.getElementById('sales-search-input').value = '';
    if (document.getElementById('sales-month-filter')) document.getElementById('sales-month-filter').value = '';
    if (document.getElementById('sales-status-filter')) document.getElementById('sales-status-filter').value = '';
    renderSalesLedgerTable(STATE.shipments);
}

// --- PURCHASE LEDGER ENGINE (Dedicated Vendor & Line Purchase Flow) ---
function renderPurchaseLedgerTable(customList = null) {
    const tbody = document.getElementById('table-purchase-ledger-body');
    if (!tbody) return;

    const list = customList !== null ? customList : (STATE.shipments || []);

    // Compute Summary KPIs
    let totalPur = 0;
    let totalPaid = 0;
    list.forEach(s => {
        const pur = parseFloat(s.purchase_amount) || 0;
        const paid = s.purchase_status === 'PAID' ? pur : (s.purchase_status === 'PARTIAL' ? pur * 0.5 : 0);
        totalPur += pur;
        totalPaid += paid;
    });
    const balancePay = Math.max(0, totalPur - totalPaid);

    if (document.getElementById('purchase-kpi-total-cost')) {
        document.getElementById('purchase-kpi-total-cost').innerText = formatCurrencyINR(totalPur);
    }
    if (document.getElementById('purchase-kpi-total-paid')) {
        document.getElementById('purchase-kpi-total-paid').innerText = formatCurrencyINR(totalPaid);
    }
    if (document.getElementById('purchase-kpi-balance-pay')) {
        document.getElementById('purchase-kpi-balance-pay').innerText = formatCurrencyINR(balancePay);
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 30px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-file-contract" style="font-size: 24px; margin-bottom: 8px; display: block;"></i> No Purchase Records Found.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(s => {
        const safeId = String(s.id).replace(/[^a-zA-Z0-9]/g, '_');
        const purAmt = parseFloat(s.purchase_amount) || 0;
        const vendStatus = s.purchase_status || 'UNPAID';
        const paidAmt = vendStatus === 'PAID' ? purAmt : (vendStatus === 'PARTIAL' ? purAmt * 0.5 : 0);
        const balPay = Math.max(0, purAmt - paidAmt);

        let vendBadge = 'status-unpaid';
        if (vendStatus === 'PAID') vendBadge = 'status-paid';
        else if (vendStatus === 'PARTIAL') vendBadge = 'status-partial';

        let purItems = [];
        try {
            purItems = typeof s.purchase_items === 'string' ? JSON.parse(s.purchase_items) : (s.purchase_items || []);
        } catch (e) { purItems = []; }

        const itemsHtml = purItems.length > 0 ? `
            <table class="erp-table" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; margin-top: 8px; font-size: 11.5px;">
                <thead>
                    <tr style="background: #fdf2f2; color: #991b1b;">
                        <th style="padding: 5px 8px;">Vendor / Shipping Line</th>
                        <th style="padding: 5px 8px;">Expense / Charge Item</th>
                        <th style="padding: 5px 8px; text-align: center;">Currency</th>
                        <th style="padding: 5px 8px; text-align: right;">Foreign Amt</th>
                        <th style="padding: 5px 8px; text-align: center;">Ex. Rate</th>
                        <th style="padding: 5px 8px; text-align: right;">Total INR (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${purItems.map(it => `
                        <tr>
                            <td style="padding: 5px 8px; font-weight: 700; color: #0f172a;">${it.vendor_name || '-'}</td>
                            <td style="padding: 5px 8px; color: #475569;">${it.expense_name || it.expense_description || '-'}</td>
                            <td style="padding: 5px 8px; text-align: center;">${it.currency || 'INR'}</td>
                            <td style="padding: 5px 8px; text-align: right;">${(parseFloat(it.foreign_amount) || 0).toLocaleString('en-IN')}</td>
                            <td style="padding: 5px 8px; text-align: center;">${it.ex_rate || 1}</td>
                            <td style="padding: 5px 8px; text-align: right; font-weight: 800; color: #b91c1c;">${formatCurrencyINR(it.amount || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : `<div style="font-size: 12px; color: #64748b; font-style: italic; margin-top: 6px;">No vendor items breakdown available.</div>`;

        return `
            <tr class="shipment-main-row" id="pur-row-${safeId}">
                <td class="col-expand" style="text-align: center; white-space: nowrap;">
                    <button type="button" onclick="togglePurchaseLedgerRowExpand('${safeId}')" style="background: none; border: none; cursor: pointer;">
                        <i id="pur-expand-icon-${safeId}" class="fa-solid fa-circle-plus" style="font-size: 16px; color: var(--neon-blue);"></i>
                    </button>
                </td>
                <td class="col-id" data-label="Shipment ID"><strong style="color: var(--neon-blue); font-size: 13px; font-weight: 800;">${s.id}</strong></td>
                <td class="col-date" data-label="Purchase Date"><span>${s.purchase_date || s.date}</span></td>
                <td class="col-vendor" data-label="Vendor / Shipping Line"><strong>${s.line_name || 'General Vendor'}</strong> <small style="color: var(--text-muted);">(${s.transport_name || 'Transporter'})</small></td>
                <td class="col-client" data-label="Client"><strong>${s.company_name}</strong></td>
                <td class="col-amount" data-label="Purchase Cost" style="text-align: right;"><strong style="font-size: 13px; color: var(--brand-red);">${formatCurrencyINR(purAmt)}</strong></td>
                <td class="col-paid" data-label="Paid to Vendor" style="text-align: right;"><strong style="font-size: 13px; color: var(--neon-green);">${formatCurrencyINR(paidAmt)}</strong></td>
                <td class="col-balance" data-label="Balance Payable" style="text-align: right;"><strong style="font-size: 13px; color: ${balPay > 0 ? 'var(--neon-amber)' : 'var(--neon-green)'};">${formatCurrencyINR(balPay)}</strong></td>
                <td class="col-status" data-label="Status" style="text-align: center;"><span class="status-pill ${vendBadge}">${vendStatus}</span></td>
                <td class="action-cell">
                    <button type="button" class="btn-icon-action btn-icon-edit" onclick="navigateRoute('/shipment-entry/edit/${encodeURIComponent(s.id)}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button type="button" class="btn-icon-action btn-icon-delete" onclick="deleteShipment('${s.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    <button type="button" class="btn-action" onclick="openVendorPaymentForShipment('', '${s.id}', ${purAmt})" style="background: rgba(255, 59, 48, 0.1); color: var(--brand-red); border-color: rgba(255, 59, 48, 0.3); font-weight: 700;" title="Pay Vendor Bill for ${s.id}"><i class="fa-solid fa-money-bill-transfer"></i> Pay Vendor</button>
                </td>
            </tr>
            <tr id="pur-sub-row-${safeId}" style="display: none; background: #fbfaf7;">
                <td colspan="10" style="padding: 12px 18px; border-bottom: 2px solid #cbd5e1;">
                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                            <strong style="font-size: 13px; color: #991b1b;"><i class="fa-solid fa-truck-ramp-box"></i> Vendor Purchase & Line Breakdown (${s.id})</strong>
                            <span style="font-size: 12px; color: #64748b;">Client: <strong>${s.company_name}</strong> | Type: <strong>${s.shipment_type || 'Export'}</strong></span>
                        </div>
                        ${itemsHtml}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function togglePurchaseLedgerRowExpand(safeId) {
    const sub = document.getElementById(`pur-sub-row-${safeId}`);
    const icon = document.getElementById(`pur-expand-icon-${safeId}`);
    if (!sub) return;
    const isClosed = sub.style.display === 'none' || !sub.style.display;
    sub.style.display = isClosed ? 'table-row' : 'none';
    if (icon) {
        icon.className = `fa-solid ${isClosed ? 'fa-circle-minus' : 'fa-circle-plus'}`;
        icon.style.color = isClosed ? '#dc2626' : '#2563eb';
    }
}

function filterPurchaseLedger() {
    const q = (document.getElementById('purchase-search-input')?.value || '').toLowerCase().trim();
    const month = document.getElementById('purchase-month-filter')?.value;
    const status = document.getElementById('purchase-status-filter')?.value;

    let filtered = [...(STATE.shipments || [])];
    if (q) {
        filtered = filtered.filter(s =>
            String(s.id || '').toLowerCase().includes(q) ||
            String(s.line_name || '').toLowerCase().includes(q) ||
            String(s.transport_name || '').toLowerCase().includes(q) ||
            String(s.company_name || '').toLowerCase().includes(q)
        );
    }
    if (month) {
        filtered = filtered.filter(s => (s.date || '').startsWith(month) || (s.purchase_date || '').startsWith(month));
    }
    if (status) {
        filtered = filtered.filter(s => (s.purchase_status || 'UNPAID') === status);
    }
    renderPurchaseLedgerTable(filtered);
}

function resetPurchaseLedgerFilters() {
    if (document.getElementById('purchase-search-input')) document.getElementById('purchase-search-input').value = '';
    if (document.getElementById('purchase-month-filter')) document.getElementById('purchase-month-filter').value = '';
    if (document.getElementById('purchase-status-filter')) document.getElementById('purchase-status-filter').value = '';
    renderPurchaseLedgerTable(STATE.shipments);
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
                <td class="action-cell">
                    <button type="button" class="btn-icon-action btn-icon-edit" onclick="openClientModal('${c.id}')" title="Edit Client"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button type="button" class="btn-icon-action btn-icon-delete" onclick="deleteClient('${c.id}')" title="Delete Client"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
            <tr id="sub-row-client_${safeId}" class="master-detail-subrow" style="display: none; background: #f8fafc;">
                <td colspan="9" style="padding: 10px 14px; border-bottom: 2px solid #cbd5e1;">
                    <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 12px 14px; font-size: 13px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <div style="font-weight: 700; font-size: 14px; color: #0f172a;"><i class="fa-solid fa-building"></i> Client Details (${c.id})</div>
                            <div style="display: flex; gap: 6px;">
                                <button class="btn-action" onclick="openClientModal('${c.id}')" style="color: #2563eb; font-weight: 700; padding: 4px 8px;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                                <button class="btn-action" onclick="deleteClient('${c.id}')" style="color: #c83228; font-weight: 700; padding: 4px 8px;"><i class="fa-solid fa-trash"></i> Delete</button>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <div><strong>Company Name:</strong> ${c.name}</div>
                            <div><strong>Contact Person:</strong> ${c.contact_person || 'N/A'}</div>
                            <div><strong>Mobile:</strong> ${c.mobile || 'N/A'}</div>
                            <div><strong>Email:</strong> ${c.email || 'N/A'}</div>
                            <div><strong>GSTIN:</strong> ${c.gstin || 'N/A'}</div>
                            <div><strong>Credit Terms:</strong> ${c.credit_terms || '30 Days'}</div>
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
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 24px; color: var(--text-muted); font-weight: 600;">No Vendors Registered in Master Registry</td></tr>`;
        return;
    }

    tbody.innerHTML = dataList.map(v => {
        const safeId = String(v.id).replace(/[^a-zA-Z0-9]/g, '_');
        const linkedJobs = v.linked_shipments || [];
        const totalPur = parseFloat(v.total_purchase_amount) || 0;
        const totalPaid = parseFloat(v.total_paid_amount) || 0;
        const balPay = parseFloat(v.balance_payable) || 0;

        let jobsTableHtml = '';
        if (linkedJobs.length > 0) {
            jobsTableHtml = `
                <div style="margin-top: 10px;">
                    <div style="font-weight: 800; font-size: 12.5px; color: #1c2024; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                        <span><i class="fa-solid fa-boxes-packing" style="color: #c83228;"></i> Linked Shipments / Jobs (${linkedJobs.length})</span>
                        <span style="font-size: 11px; color: #6c727a;">Direct Payment & Freight Ledger Link</span>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e5e2da; border-radius: 6px; overflow: hidden;">
                        <table style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1px solid #e5e2da; color: #64748b; font-weight: 700; text-align: left;">
                                    <th style="padding: 6px 8px; width: 25%;">Shipment ID</th>
                                    <th style="padding: 6px 8px; width: 12%;">Date</th>
                                    <th style="padding: 6px 8px; width: 20%;">Client / Importer</th>
                                    <th style="padding: 6px 8px; width: 16%;">Service / Line Charge</th>
                                    <th style="padding: 6px 8px; text-align: right; width: 13%;">Purchase Amt</th>
                                    <th style="padding: 6px 8px; text-align: center; width: 55px;">Status</th>
                                    <th style="padding: 6px 8px; text-align: right; width: 110px;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${linkedJobs.map(j => `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 6px 8px; font-weight: 800; color: #2563eb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${j.shipment_id}</td>
                                        <td style="padding: 6px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${j.date || '-'}</td>
                                        <td style="padding: 6px 8px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${j.client_company || '-'}</td>
                                        <td style="padding: 6px 8px; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${j.expense_description || 'Purchase'}</td>
                                        <td style="padding: 6px 8px; text-align: right; font-weight: 800; color: #1c2024; white-space: nowrap;">₹${(parseFloat(j.purchase_amount) || 0).toLocaleString('en-IN')}</td>
                                        <td style="padding: 6px 8px; text-align: center;"><span class="status-pill status-${(j.purchase_status || 'unpaid').toLowerCase()}">${j.purchase_status || 'UNPAID'}</span></td>
                                        <td style="padding: 6px 8px; text-align: right; white-space: nowrap;">
                                            <button class="btn-action" onclick="openVendorPaymentForShipment('${v.id}', '${j.shipment_id}', ${parseFloat(j.purchase_amount) || 0})" style="background: #ecfdf5; color: #047857; font-weight: 700; font-size: 10.5px; padding: 3px 7px; margin-right: 2px; border-color: #a7f3d0;" title="Pay Bill for ${j.shipment_id}">
                                                <i class="fa-solid fa-money-bill-wave"></i> Pay
                                            </button>
                                            <button class="btn-action" onclick="openFullEditShipmentPage('${j.shipment_id}')" style="background: #eff6ff; color: #2563eb; font-weight: 700; font-size: 10.5px; padding: 3px 7px;" title="Open Shipment Job">
                                                <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            jobsTableHtml = `
                <div style="margin-top: 8px; padding: 10px 12px; background: #fafbfa; border: 1px dashed #cbd5e1; border-radius: 6px; color: #64748b; font-size: 12px;">
                    <i class="fa-solid fa-circle-info" style="color: #64748b; margin-right: 6px;"></i> No shipments currently linked to this vendor. Entering this vendor name in any shipment automatically links it here.
                </div>
            `;
        }

        return `
            <tr>
                <td style="text-align: center; padding: 6px 2px;">
                    <button type="button" onclick="toggleMasterRowExpand('vendor_${safeId}')" style="background: none; border: none; cursor: pointer; padding: 0;">
                        <i id="expand-icon-vendor_${safeId}" class="fa-solid fa-circle-plus" style="font-size: 16px; color: #2563eb;"></i>
                    </button>
                </td>
                <td><strong style="color: var(--primary); font-size: 12px;">${v.id}</strong></td>
                <td style="white-space: normal; word-break: break-word;"><strong style="color: #1c2024; font-size: 12.5px;">${v.name}</strong></td>
                <td><span class="status-pill status-partial">${v.vendor_type || 'General'}</span></td>
                <td style="text-align: center;">
                    <span class="status-pill ${linkedJobs.length > 0 ? 'status-paid' : 'status-unpaid'}" style="font-weight: 800; cursor: pointer;" onclick="toggleMasterRowExpand('vendor_${safeId}')">
                        ${linkedJobs.length} Jobs
                    </span>
                </td>
                <td style="text-align: right; font-weight: 800;">₹${totalPur.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="text-align: right; font-weight: 800; color: var(--success);">₹${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="text-align: right; font-weight: 800; color: ${balPay > 0 ? 'var(--danger)' : 'var(--success)'};">
                    ₹${balPay.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style="text-align: center;"><span class="status-pill ${v.status === 'ACTIVE' ? 'status-paid' : 'status-unpaid'}">${v.status || 'ACTIVE'}</span></td>
                <td class="action-cell">
                    <button type="button" class="btn-icon-action btn-icon-edit" onclick="openVendorModal('${v.id}')" title="Edit Vendor"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button type="button" class="btn-icon-action btn-icon-delete" onclick="deleteVendor('${v.id}')" title="Delete Vendor"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
            <tr id="sub-row-vendor_${safeId}" class="master-detail-subrow" style="display: none; background: #fbfaf7;">
                <td colspan="10" style="padding: 10px 12px; border-bottom: 2px solid #e5e2da; white-space: normal;">
                    <div style="background: #ffffff; border: 1px solid #e5e2da; border-radius: 8px; padding: 12px 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #edebe6; padding-bottom: 8px; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                            <div style="font-weight: 800; font-size: 14px; color: #1c2024;">
                                <i class="fa-solid fa-truck-field" style="color: #c83228; margin-right: 6px;"></i> ${v.name} (${v.id})
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <button class="btn-action" onclick="openVendorModal('${v.id}')" style="background: #eff6ff; color: #2563eb; font-weight: 700; font-size: 11.5px; padding: 4px 8px;"><i class="fa-solid fa-pen"></i> Edit Profile</button>
                                <button class="btn-action" onclick="openVendorPaymentForShipment('${v.id}', '', '')" style="background: #fdf2f2; color: #c83228; font-weight: 700; font-size: 11.5px; padding: 4px 8px;"><i class="fa-solid fa-money-bill-transfer"></i> Record Payment</button>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 12px;">
                            <div><strong style="color: #64748b; font-size: 10.5px; text-transform: uppercase;">Category:</strong><br><strong>${v.vendor_type || 'General'}</strong></div>
                            <div><strong style="color: #64748b; font-size: 10.5px; text-transform: uppercase;">Contact & Phone:</strong><br><span>${v.contact_person || 'N/A'}${v.mobile ? ` (${v.mobile})` : ''}</span></div>
                            <div><strong style="color: #64748b; font-size: 10.5px; text-transform: uppercase;">GSTIN / PAN:</strong><br><span>${v.gstin || 'N/A'}${v.pan ? ` / ${v.pan}` : ''}</span></div>
                            <div><strong style="color: #64748b; font-size: 10.5px; text-transform: uppercase;">Credit Terms:</strong><br><strong>${v.credit_terms || '15 Days'}</strong></div>
                        </div>

                        ${v.address || v.bank_details || v.remarks ? `
                            <div style="margin-top: 8px; font-size: 12px; color: #475569; background: #f8fafc; padding: 6px 10px; border-radius: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <div><strong>Bank Details:</strong> ${v.bank_details || 'N/A'}</div>
                                <div><strong>Address / Terms:</strong> ${v.address || ''} ${v.remarks ? `(${v.remarks})` : ''}</div>
                            </div>
                        ` : ''}

                        ${jobsTableHtml}
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
            <td class="action-cell">
                <button type="button" class="btn-icon-action btn-icon-delete" onclick="deleteVendorPayment('${vp.id}')" title="Delete Vendor Payment"><i class="fa-solid fa-trash"></i></button>
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
        
        let margin = 0;
        if (r.margin_pct !== undefined && !isNaN(parseFloat(r.margin_pct))) {
            margin = parseFloat(r.margin_pct);
        } else if (sAmt > 0) {
            margin = parseFloat(((profit / sAmt) * 100).toFixed(2));
        } else if (pAmt > 0) {
            margin = -100.0;
        } else {
            margin = 0.0;
        }

        const isPositive = profit > 0;
        const isNegative = profit < 0;
        const profitColor = isNegative ? 'var(--danger)' : (isPositive ? 'var(--success)' : '#64748b');
        const marginColor = margin < 0 ? 'var(--danger)' : (margin > 0 ? 'var(--success)' : '#64748b');
        const formattedProfit = (profit < 0 ? '-₹' : '₹') + Math.abs(profit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formattedMargin = (margin > 0 ? '+' : '') + margin.toFixed(2) + '%';

        return `
            <tr>
                <td><strong>${r.shipment_id || r.id}</strong></td>
                <td>${r.date}</td>
                <td><strong>${r.company_name}</strong></td>
                <td>₹${sAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>₹${pAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td><strong style="color: ${profitColor}; font-weight: 800; font-size: 13px;">${formattedProfit}</strong></td>
                <td><strong style="color: ${marginColor}; font-weight: 800; font-size: 13px;">${formattedMargin}</strong></td>
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
    tbody.innerHTML = list.map(r => {
        const sAmt = parseFloat(r.sales_amount) || 0;
        const pAmt = parseFloat(r.purchase_amount) || 0;
        const profit = r.net_profit !== undefined ? parseFloat(r.net_profit) : (sAmt - pAmt);
        
        let margin = 0;
        if (r.margin_pct !== undefined && !isNaN(parseFloat(r.margin_pct))) {
            margin = parseFloat(r.margin_pct);
        } else if (sAmt > 0) {
            margin = parseFloat(((profit / sAmt) * 100).toFixed(2));
        } else if (pAmt > 0) {
            margin = -100.0;
        } else {
            margin = 0.0;
        }

        const isPositive = profit > 0;
        const isNegative = profit < 0;
        const profitColor = isNegative ? 'var(--danger)' : (isPositive ? 'var(--success)' : '#64748b');
        const marginColor = margin < 0 ? 'var(--danger)' : (margin > 0 ? 'var(--success)' : '#64748b');
        const formattedProfit = (profit < 0 ? '-₹' : '₹') + Math.abs(profit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formattedMargin = (margin > 0 ? '+' : '') + margin.toFixed(2) + '%';

        return `
            <tr>
                <td><strong>${r.shipment_id}</strong></td>
                <td>${r.date}</td>
                <td><strong>${r.company_name}</strong></td>
                <td>₹${sAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>₹${pAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td><strong style="color: ${profitColor}; font-weight: 800; font-size: 13px;">${formattedProfit}</strong></td>
                <td><strong style="color: ${marginColor}; font-weight: 800; font-size: 13px;">${formattedMargin}</strong></td>
            </tr>
        `;
    }).join('');
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
    const datalist = document.getElementById('vendor-list-options');
    if (datalist) {
        datalist.innerHTML = (STATE.vendors || []).map(v => 
            `<option value="${v.name}">${v.name}</option>`
        ).join('');
    }

    const modalVpSelect = document.getElementById('modal-vp-vendor-select');
    if (modalVpSelect) {
        modalVpSelect.innerHTML = '<option value="">-- Select Vendor --</option>' + 
            (STATE.vendors || []).map(v => `<option value="${v.id}">${v.name}</option>`).join('');
    }
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
        <td><input type="number" class="form-control sale-taxable input-readonly" value="0" readonly></td>
        <td><input type="number" class="form-control sale-gst-pct" value="${initGst}" step="0.01" oninput="recalculateFormTotals()"></td>
        <td><input type="number" class="form-control sale-gst-amt input-readonly" value="0" readonly></td>
        <td><input type="number" class="form-control sale-total input-total-green" value="0" readonly></td>
        <td style="text-align: center;"><button type="button" class="btn-action" style="color: var(--brand-red);" onclick="removeFormRow('${rowId}')">&times;</button></td>
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
    if (data.foreign_amount !== undefined && parseFloat(data.foreign_amount) > 0) {
        baseAmt = parseFloat(data.foreign_amount);
    } else if (data.taxable !== undefined && parseFloat(data.taxable) > 0 && exRate > 0) {
        baseAmt = curr === 'INR' ? parseFloat(data.taxable) : (parseFloat(data.taxable) / exRate);
    } else if (data.amount !== undefined && parseFloat(data.amount) > 0 && exRate > 0) {
        baseAmt = curr === 'INR' ? parseFloat(data.amount) : (parseFloat(data.amount) / exRate);
    }

    const initGst = data.gst_pct !== undefined ? data.gst_pct : 18;

    tr.innerHTML = `
        <td>
            <input type="text" list="vendor-list-options" class="form-control pur-vendor-name" value="${data.vendor_name || ''}" placeholder="Type or Select Vendor" required autocomplete="off">
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
        <td><input type="number" class="form-control pur-taxable input-readonly" value="0" readonly></td>
        <td><input type="number" class="form-control pur-gst-pct" value="${initGst}" step="0.01" oninput="recalculateFormTotals()"></td>
        <td><input type="number" class="form-control pur-gst-amt input-readonly" value="0" readonly></td>
        <td><input type="number" class="form-control pur-total input-total-red" value="0" readonly></td>
        <td style="text-align: center;"><button type="button" class="btn-action" style="color: var(--brand-red);" onclick="removeFormRow('${rowId}')">&times;</button></td>
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
    if (e) e.preventDefault();

    const isEdit = document.getElementById('form-shipment-is-edit')?.value === 'true';
    const shpId = (document.getElementById('form-shipment-id')?.value || '').trim();
    const clientId = document.getElementById('form-shipment-client-id')?.value;
    const clientSelect = document.getElementById('form-shipment-client-select');
    const selectedText = clientSelect && clientSelect.selectedIndex >= 0 ? clientSelect.options[clientSelect.selectedIndex]?.text : '';
    const companyName = (selectedText.split('(')[0] || '').trim();
    const shipmentDate = document.getElementById('form-shipment-date')?.value;

    if (!shpId) {
        showToast('Please enter a valid Shipment ID (e.g. AKASHA/CLI-101/001).', 'warning');
        return;
    }
    if (!clientId || !companyName || companyName === '-- Select Client --' || companyName === 'Select Client') {
        showToast('Please select a valid Client Account from the dropdown.', 'warning');
        return;
    }
    if (!shipmentDate) {
        showToast('Please specify a valid Shipment Booking Date.', 'warning');
        return;
    }

    const salesItems = [];
    document.querySelectorAll('#form-sales-rows-body tr').forEach(tr => {
        const sName = (tr.querySelector('.sale-service-name')?.value || '').trim();
        const rate = parseFloat(tr.querySelector('.sale-rate')?.value) || 0;
        const qty = parseFloat(tr.querySelector('.sale-qty')?.value) || 1;
        const exRate = parseFloat(tr.querySelector('.sale-ex-rate')?.value) || 1;
        const gstPct = parseFloat(tr.querySelector('.sale-gst-pct')?.value) || 18;
        const taxable = parseFloat(tr.querySelector('.sale-taxable')?.value) || (rate * qty * exRate);
        const gstAmt = parseFloat(tr.querySelector('.sale-gst-amt')?.value) || ((taxable * gstPct) / 100);
        const amount = parseFloat(tr.querySelector('.sale-total')?.value) || (taxable + gstAmt);

        if (sName || amount > 0 || document.querySelectorAll('#form-sales-rows-body tr').length === 1) {
            salesItems.push({
                service_name: sName || 'Ocean Freight',
                currency: tr.querySelector('.sale-currency')?.value || 'INR',
                ex_rate: exRate,
                qty: qty,
                rate: rate,
                taxable: taxable,
                gst_pct: gstPct,
                gst_amt: gstAmt,
                amount: amount
            });
        }
    });

    const purchaseItems = [];
    document.querySelectorAll('#form-purchase-rows-body tr').forEach(tr => {
        const vName = (tr.querySelector('.pur-vendor-name')?.value || '').trim();
        const eName = (tr.querySelector('.pur-expense-name')?.value || '').trim();
        const fAmt = parseFloat(tr.querySelector('.pur-amount')?.value) || 0;
        const exRate = parseFloat(tr.querySelector('.pur-ex-rate')?.value) || 1;
        const gstPct = parseFloat(tr.querySelector('.pur-gst-pct')?.value) || 18;
        const taxable = parseFloat(tr.querySelector('.pur-taxable')?.value) || (fAmt * exRate);
        const gstAmt = parseFloat(tr.querySelector('.pur-gst-amt')?.value) || ((taxable * gstPct) / 100);
        const amount = parseFloat(tr.querySelector('.pur-total')?.value) || (taxable + gstAmt);

        if (vName || eName || amount > 0 || document.querySelectorAll('#form-purchase-rows-body tr').length === 1) {
            purchaseItems.push({
                vendor_name: vName || 'General Vendor',
                expense_name: eName || 'Freight',
                currency: tr.querySelector('.pur-currency')?.value || 'INR',
                ex_rate: exRate,
                foreign_amount: fAmt,
                taxable: taxable,
                gst_pct: gstPct,
                gst_amt: gstAmt,
                amount: amount
            });
        }
    });

    const payload = {
        id: shpId,
        date: shipmentDate,
        client_id: clientId,
        company_name: companyName,
        line_name: (document.getElementById('form-shipment-line')?.value || '').trim(),
        shipment_type: document.getElementById('form-shipment-type')?.value || 'EXPORT FCL',
        sb_be_no: (document.getElementById('form-shipment-sb-be')?.value || '').trim(),
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
            showToast(data.message || 'Unable to save shipment. Please check your inputs.', 'error');
            return;
        }

        showToast(isEdit ? `Shipment ${shpId} updated successfully!` : `Shipment ${shpId} created successfully!`, 'success');
        await fetchBackendAPIData();
        navigateRoute('/shipment-entry');
    } catch (err) {
        showToast(err.message || 'Network error while connecting to ERP server.', 'error');
    }
}

async function loadAllStateData() {
    return await fetchBackendAPIData();
}

// --- MODAL & PAYMENT HANDLERS ---
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
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
    if (e) e.preventDefault();

    const shpId = (document.getElementById('modal-pay-shipment-select')?.value || '').trim();
    const paymentDate = document.getElementById('modal-pay-date')?.value;
    const amount = parseFloat(document.getElementById('modal-pay-amount')?.value) || 0;
    const paymentMode = document.getElementById('modal-pay-mode')?.value || 'Bank Transfer';
    const bank = (document.getElementById('modal-pay-bank')?.value || '').trim();
    const utr = (document.getElementById('modal-pay-utr')?.value || '').trim();

    if (!shpId) {
        showToast('Please select a valid Shipment Invoice to record payment.', 'warning');
        return;
    }
    if (!paymentDate) {
        showToast('Please specify the Payment Receipt Date.', 'warning');
        return;
    }
    if (amount <= 0 || isNaN(amount)) {
        showToast('Please enter a valid positive payment amount.', 'warning');
        return;
    }

    const payload = {
        shipment_id: shpId,
        payment_date: paymentDate,
        amount,
        payment_mode: paymentMode,
        bank,
        utr
    };

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/payments`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Error recording customer payment.', 'error');
            return;
        }

        showToast(`Customer payment of ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} recorded successfully!`, 'success');
        closeModal('modal-receive-payment');
        fetchShipmentsData();
        fetchPaymentsReceivedData();
        fetchDashboardKPIs();
    } catch (err) {
        showToast('Network error while connecting to payment service.', 'error');
    }
}

async function openVendorPaymentModal() {
    if (!STATE.shipments || STATE.shipments.length === 0) {
        await fetchShipmentsData();
    }
    const shpSelect = document.getElementById('modal-vp-shipment-select');
    if (shpSelect) {
        shpSelect.innerHTML = '<option value="">-- Select Shipment --</option>' + 
            (STATE.shipments || []).map(s => `<option value="${s.id}">${s.id} (${s.company_name})</option>`).join('');
    }
    populateVendorDropdowns();
    if (shpSelect && shpSelect.options.length > 1) {
        shpSelect.selectedIndex = 1;
        onVendorPaymentShipmentChange();
    }
    const txtInput = document.getElementById('modal-vp-vendor-text');
    if (txtInput) txtInput.style.display = 'none';

    document.getElementById('modal-vp-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-vendor-payment').style.display = 'flex';
}

function onVendorPaymentShipmentChange() {
    const shpId = document.getElementById('modal-vp-shipment-select')?.value;
    const vendorSelect = document.getElementById('modal-vp-vendor-select');
    const txtInput = document.getElementById('modal-vp-vendor-text');
    const amtInput = document.getElementById('modal-vp-amount');
    if (!vendorSelect) return;

    if (!shpId) {
        populateVendorDropdowns();
        return;
    }

    const s = STATE.shipments.find(item => item.id === shpId);
    let vendorOptionsHtml = '<option value="">-- Select Vendor --</option>';
    let purTotal = 0;

    if (s) {
        purTotal = parseFloat(s.purchase_amount) || 0;
        let purItems = [];
        try {
            purItems = typeof s.purchase_items === 'string' ? JSON.parse(s.purchase_items) : s.purchase_items;
        } catch (e) {}

        const vendorSet = new Set();
        if (Array.isArray(purItems) && purItems.length > 0) {
            purItems.forEach(item => {
                const vName = (item.vendor_name || item.name || '').trim();
                if (vName) vendorSet.add(vName);
            });
        }
        if (s.line_name) vendorSet.add(s.line_name.trim());
        if (s.transport_name) vendorSet.add(s.transport_name.trim());

        (STATE.vendors || []).forEach(v => {
            if (v.name) vendorSet.add(v.name.trim());
        });

        vendorSet.forEach(vName => {
            vendorOptionsHtml += `<option value="${vName}">${vName}</option>`;
        });
    } else {
        (STATE.vendors || []).forEach(v => {
            vendorOptionsHtml += `<option value="${v.id}">${v.name}</option>`;
        });
    }

    vendorSelect.innerHTML = vendorOptionsHtml;
    if (vendorSelect.options.length > 1) {
        vendorSelect.selectedIndex = 1;
        if (txtInput) txtInput.style.display = 'none';
    } else {
        if (txtInput) {
            txtInput.style.display = 'block';
            if (s && s.line_name) txtInput.value = s.line_name;
        }
    }

    if (amtInput && purTotal > 0) {
        amtInput.value = purTotal.toFixed(2);
    }
}

async function handleSaveVendorPayment(e) {
    if (e) e.preventDefault();

    const shpId = document.getElementById('modal-vp-shipment-select')?.value;
    const txtVal = document.getElementById('modal-vp-vendor-text')?.value;
    const vendorVal = document.getElementById('modal-vp-vendor-select')?.value;
    const vendorSelectEl = document.getElementById('modal-vp-vendor-select');
    const selectedText = vendorSelectEl && vendorSelectEl.selectedIndex >= 0 ? vendorSelectEl.options[vendorSelectEl.selectedIndex]?.text : '';
    const vendorName = (txtVal || vendorVal || selectedText || '').split('(')[0].trim();
    const amount = parseFloat(document.getElementById('modal-vp-amount')?.value) || 0;
    const paymentDate = document.getElementById('modal-vp-date')?.value;
    const paymentMode = document.getElementById('modal-vp-mode')?.value || 'Bank Transfer';
    const refNo = (document.getElementById('modal-vp-ref')?.value || '').trim();

    if (!shpId) {
        showToast('Please select a Shipment Job for vendor disbursement.', 'warning');
        return;
    }
    if (!vendorName) {
        showToast('Please select or specify a Vendor / Shipping Line.', 'warning');
        return;
    }
    if (!paymentDate) {
        showToast('Please specify the Vendor Payment Date.', 'warning');
        return;
    }
    if (amount <= 0 || isNaN(amount)) {
        showToast('Please enter a valid positive disbursement amount.', 'warning');
        return;
    }

    const payload = {
        shipment_id: shpId,
        vendor_id: vendorVal || vendorName,
        vendor_name: vendorName,
        amount,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        reference_no: refNo
    };

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/vendor-payments`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Error recording vendor payment.', 'error');
            return;
        }

        showToast(`Vendor payment of ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} recorded successfully!`, 'success');
        closeModal('modal-vendor-payment');
        fetchVendorPaymentsData();
        fetchShipmentsData();
        fetchDashboardKPIs();
        fetchVendorsData();
    } catch (err) {
        showToast('Network error while recording vendor payment.', 'error');
    }
}

function openVendorPaymentForShipment(vendorId, shipmentId, amount) {
    const modal = document.getElementById('modal-vendor-payment');
    if (!modal) return;
    const form = modal.querySelector('form');
    if (form) form.reset();

    const shpSelect = document.getElementById('modal-vp-shipment-select');
    if (shpSelect) {
        shpSelect.innerHTML = '<option value="">-- Select Shipment --</option>' + 
            (STATE.shipments || []).map(s => `<option value="${s.id}">${s.id} (${s.company_name})</option>`).join('');
        shpSelect.value = shipmentId;
    }

    onVendorPaymentShipmentChange();

    const vendorSelect = document.getElementById('modal-vp-vendor-select');
    const vObj = (STATE.vendors || []).find(item => item.id === vendorId);
    const vName = vObj ? vObj.name : vendorId;

    if (vendorSelect) {
        let matched = false;
        for (let i = 0; i < vendorSelect.options.length; i++) {
            const optVal = vendorSelect.options[i].value;
            const optText = vendorSelect.options[i].text;
            if (optVal === vendorId || optVal === vName || optText.includes(vName)) {
                vendorSelect.selectedIndex = i;
                matched = true;
                break;
            }
        }
        if (!matched) {
            vendorSelect.innerHTML += `<option value="${vName}" selected>${vName}</option>`;
        }
    }

    const amtInput = document.getElementById('modal-vp-amount');
    if (amtInput && amount) {
        amtInput.value = parseFloat(amount).toFixed(2);
    }

    const dateInput = document.getElementById('modal-vp-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    modal.style.display = 'flex';
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

function openClientModal(clientId = '') {
    const modal = document.getElementById('modal-client');
    if (!modal) return;
    const form = modal.querySelector('form');
    if (form) form.reset();

    const titleEl = document.getElementById('modal-client-title');
    const isEditEl = document.getElementById('modal-client-is-edit');
    const idEl = document.getElementById('modal-client-id');

    if (clientId) {
        const c = (STATE.clients || []).find(item => item.id === clientId);
        if (c) {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Client (${c.id})`;
            if (isEditEl) isEditEl.value = 'true';
            if (idEl) idEl.value = c.id;

            if (document.getElementById('modal-client-name')) document.getElementById('modal-client-name').value = c.name || '';
            if (document.getElementById('modal-client-contact')) document.getElementById('modal-client-contact').value = c.contact_person || '';
            if (document.getElementById('modal-client-mobile')) document.getElementById('modal-client-mobile').value = c.mobile || '';
            if (document.getElementById('modal-client-email')) document.getElementById('modal-client-email').value = c.email || '';
            if (document.getElementById('modal-client-gstin')) document.getElementById('modal-client-gstin').value = c.gstin || '';
            if (document.getElementById('modal-client-credit')) document.getElementById('modal-client-credit').value = c.credit_terms || '30 Days';
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-building-user"></i> Add New Client Master`;
        if (isEditEl) isEditEl.value = 'false';
        if (idEl) idEl.value = '';
    }

    modal.style.display = 'flex';
}

async function handleSaveClient(e) {
    if (e) e.preventDefault();

    const isEdit = document.getElementById('modal-client-is-edit')?.value === 'true';
    const clientId = (document.getElementById('modal-client-id')?.value || '').trim();
    const name = (document.getElementById('modal-client-name')?.value || '').trim();
    const contactPerson = (document.getElementById('modal-client-contact')?.value || '').trim();
    const mobile = (document.getElementById('modal-client-mobile')?.value || '').trim();
    const email = (document.getElementById('modal-client-email')?.value || '').trim();
    const gstin = (document.getElementById('modal-client-gstin')?.value || '').trim().toUpperCase();
    const creditTerms = document.getElementById('modal-client-credit')?.value || '30 Days';

    if (!name) {
        showToast('Please enter the Client Company Name.', 'warning');
        return;
    }
    if (mobile && !/^\d{10}$/.test(mobile)) {
        showToast('Please enter a valid 10-digit mobile number.', 'warning');
        return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email address (e.g. info@company.com).', 'warning');
        return;
    }
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
        showToast('Please enter a valid 15-character Indian GSTIN format.', 'warning');
        return;
    }

    const payload = {
        name,
        contact_person: contactPerson,
        mobile,
        email,
        gstin,
        credit_terms: creditTerms
    };

    try {
        const url = isEdit ? `${API_BASE_URL}/clients/${encodeURIComponent(clientId)}` : `${API_BASE_URL}/clients`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetchWithAuth(url, {
            method,
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Error saving client profile.', 'error');
            return;
        }

        showToast(isEdit ? `Client ${clientId} updated successfully!` : `Client "${name}" registered successfully!`, 'success');
        closeModal('modal-client');
        await fetchClientsData();
        populateClientDropdowns();
    } catch (err) {
        showToast('Network error while saving client account.', 'error');
    }
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

function openVendorModal(vendorId = '') {
    const modal = document.getElementById('modal-vendor');
    if (!modal) return;
    const form = modal.querySelector('form');
    if (form) form.reset();

    const titleEl = document.getElementById('modal-vendor-title');
    const isEditEl = document.getElementById('modal-vendor-is-edit');
    const idEl = document.getElementById('modal-vendor-id');

    if (vendorId) {
        const v = (STATE.vendors || []).find(item => item.id === vendorId);
        if (v) {
            if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Vendor (${v.id})`;
            if (isEditEl) isEditEl.value = 'true';
            if (idEl) idEl.value = v.id;

            if (document.getElementById('modal-vendor-name')) document.getElementById('modal-vendor-name').value = v.name || '';
            if (document.getElementById('modal-vendor-type')) document.getElementById('modal-vendor-type').value = v.vendor_type || 'Shipping Line';
            if (document.getElementById('modal-vendor-contact')) document.getElementById('modal-vendor-contact').value = v.contact_person || '';
            if (document.getElementById('modal-vendor-mobile')) document.getElementById('modal-vendor-mobile').value = v.mobile || '';
            if (document.getElementById('modal-vendor-email')) document.getElementById('modal-vendor-email').value = v.email || '';
            if (document.getElementById('modal-vendor-gstin')) document.getElementById('modal-vendor-gstin').value = v.gstin || '';
            if (document.getElementById('modal-vendor-credit')) document.getElementById('modal-vendor-credit').value = v.credit_terms || '15 Days';
            if (document.getElementById('modal-vendor-bank')) document.getElementById('modal-vendor-bank').value = v.bank_details || '';
            if (document.getElementById('modal-vendor-remarks')) document.getElementById('modal-vendor-remarks').value = v.remarks || '';
        }
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-truck-ramp-box"></i> Add New Vendor Master`;
        if (isEditEl) isEditEl.value = 'false';
        if (idEl) idEl.value = '';
    }

    modal.style.display = 'flex';
}

async function handleSaveVendor(e) {
    if (e) e.preventDefault();

    const isEdit = document.getElementById('modal-vendor-is-edit')?.value === 'true';
    const vendorId = (document.getElementById('modal-vendor-id')?.value || '').trim();
    const name = (document.getElementById('modal-vendor-name')?.value || '').trim();
    const vendorType = document.getElementById('modal-vendor-type')?.value || 'General Vendor';
    const contactPerson = (document.getElementById('modal-vendor-contact')?.value || '').trim();
    const mobile = (document.getElementById('modal-vendor-mobile')?.value || '').trim();
    const email = (document.getElementById('modal-vendor-email')?.value || '').trim();
    const gstin = (document.getElementById('modal-vendor-gstin')?.value || '').trim().toUpperCase();
    const creditTerms = document.getElementById('modal-vendor-credit')?.value || '15 Days';
    const bankDetails = (document.getElementById('modal-vendor-bank')?.value || '').trim();
    const remarks = (document.getElementById('modal-vendor-remarks')?.value || '').trim();

    if (!name) {
        showToast('Please enter the Vendor / Shipping Line Name.', 'warning');
        return;
    }
    if (mobile && !/^\d{10}$/.test(mobile)) {
        showToast('Please enter a valid 10-digit mobile number.', 'warning');
        return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email address.', 'warning');
        return;
    }

    const payload = {
        name,
        vendor_type: vendorType,
        contact_person: contactPerson,
        mobile,
        email,
        gstin,
        credit_terms: creditTerms,
        bank_details: bankDetails,
        remarks
    };

    try {
        const url = isEdit ? `${API_BASE_URL}/vendors/${encodeURIComponent(vendorId)}` : `${API_BASE_URL}/vendors`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetchWithAuth(url, {
            method,
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Error saving vendor profile.', 'error');
            return;
        }

        showToast(isEdit ? `Vendor ${vendorId} updated successfully!` : `Vendor "${name}" registered successfully!`, 'success');
        closeModal('modal-vendor');
        await fetchVendorsData();
        populateVendorDropdowns();
    } catch (err) {
        showToast('Network error while saving vendor record.', 'error');
    }
}

async function deleteVendor(vendorId) {
    if (!confirm(`Are you sure you want to delete Vendor ${vendorId}? Linked payments will be detached.`)) return;

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/vendors/${encodeURIComponent(vendorId)}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(`Vendor ${vendorId} deleted successfully.`, 'success');
            await fetchVendorsData();
        } else {
            showToast(data.message || 'Error deleting vendor record.', 'error');
        }
    } catch (e) {
        showToast('Error deleting vendor from registry.', 'error');
    }
}

async function syncAllVendorsNow() {
    try {
        showToast('Syncing all vendors from shipment records...', 'info');
        const res = await fetchWithAuth(`${API_BASE_URL}/vendors/sync`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            showToast('All vendors synced from shipments with zero duplicates!', 'success');
            await fetchVendorsData();
            await fetchShipmentsData();
        } else {
            showToast(data.message || 'Sync error', 'error');
        }
    } catch (e) {
        showToast('Network error syncing vendors', 'error');
    }
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
    if (e) e.preventDefault();

    const name = (document.getElementById('modal-service-name')?.value || '').trim();
    const type = document.getElementById('modal-service-type')?.value || 'Freight Charges';
    const gstPct = parseFloat(document.getElementById('modal-service-gst')?.value) || 18;

    if (!name) {
        showToast('Please enter the Service Name (e.g. Ocean Freight, THC).', 'warning');
        return;
    }
    if (gstPct < 0 || isNaN(gstPct)) {
        showToast('Please enter a valid GST percentage (e.g. 0, 5, 12, 18, 28).', 'warning');
        return;
    }

    const payload = {
        service_name: name,
        service_type: type,
        default_gst_pct: gstPct
    };

    try {
        const res = await fetchWithAuth(`${API_BASE_URL}/services`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            showToast(data.message || 'Error creating service catalog item.', 'error');
            return;
        }

        showToast(`Service "${name}" registered successfully!`, 'success');
        closeModal('modal-service');
        await fetchServicesData();
    } catch (err) {
        showToast('Network error while registering service item.', 'error');
    }
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
            renderSalesLedgerTable();
            renderPurchaseLedgerTable();
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

// --- DUAL THEME ENGINE (4D LUMINESCENT DARK / STUDIO LIGHT) ---
function initERPTheme() {
    const savedTheme = localStorage.getItem('akasha_erp_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleERPTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('akasha_erp_theme', next);
    updateThemeIcon(next);
    showToast(`Switched to ${next.toUpperCase()} mode`, 'info');
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar') || document.querySelector('#app-sidebar');
    const overlay = document.getElementById('mobile-sidebar-overlay');
    if (!sidebar) return;

    if (window.innerWidth <= 1024) {
        sidebar.classList.toggle('open');
        if (overlay) {
            overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
        }
    } else {
        sidebar.classList.toggle('sidebar-collapsed');
    }
}

function closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
}

function updateDateDisplay() {
    const el = document.getElementById('topbar-current-datetime') || document.getElementById('topbar-current-date');
    if (!el) return;
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    const formattedTime = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    el.innerHTML = `<span>${formattedDate} &nbsp;•&nbsp; <strong style="color: var(--text-primary); font-family: monospace; font-size: 12.5px;">${formattedTime}</strong></span>`;
}

if (!window._clockInterval) {
    window._clockInterval = setInterval(updateDateDisplay, 1000);
}

function exportTableToCSV(tableId, filename) {
    let targetEl = document.getElementById(tableId);
    if (!targetEl) return;

    // If target is tbody, get the closest parent table to include headers
    if (targetEl.tagName === 'TBODY') {
        targetEl = targetEl.closest('table') || targetEl;
    }

    let csv = [];
    const rows = targetEl.querySelectorAll('tr');

    for (let i = 0; i < rows.length; i++) {
        // Skip hidden detail rows
        if (rows[i].style.display === 'none') continue;

        const row = [], cols = rows[i].querySelectorAll('td, th');
        // Exclude action column from export
        for (let j = 0; j < cols.length; j++) {
            if (cols[j].classList.contains('action-cell') || cols[j].classList.contains('action-col') || cols[j].innerText.trim() === 'Action') {
                continue;
            }
            let cellText = cols[j].innerText.replace(/\n/g, ' ').replace(/"/g, '""').trim();
            row.push('"' + cellText + '"');
        }
        if (row.length > 0) {
            csv.push(row.join(','));
        }
    }

    const csvFile = new Blob(['\uFEFF' + csv.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const downloadLink = document.createElement('a');
    downloadLink.download = `${filename || 'Export'}_${new Date().toISOString().slice(0,10)}.csv`;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    setTimeout(() => {
        downloadLink.remove();
        window.URL.revokeObjectURL(downloadLink.href);
    }, 200);
}

function showToast(message, type = 'info') {
    let container = document.getElementById('erp-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'erp-toast-container';
        container.className = 'erp-toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `erp-toast erp-toast-${type}`;

    let iconHtml = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') iconHtml = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'error') iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';
    if (type === 'warning') iconHtml = '<i class="fa-solid fa-circle-exclamation"></i>';

    toast.innerHTML = `
        <div class="erp-toast-icon">${iconHtml}</div>
        <div class="erp-toast-msg">${message}</div>
        <button class="erp-toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('erp-toast-show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('erp-toast-show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
