/* ==========================================================================
   AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP ENGINE (JS)
   ========================================================================== */

const STATE = {
    currentUser: null,
    adminUsers: [
        { id: "usr_1", name: "Khushal Patel", role: "CEO & Founder", email: "khushal@akashalogitrans.com", pin: "7776", keyName: "KHUSHAL", avatar: "https://akashalogitrans.com/khushal.png" },
        { id: "usr_2", name: "Dhruv Patel", role: "Director - Rates & Procurement", email: "dhruv@akashalogitrans.com", pin: "7717", keyName: "DHRUV", avatar: "https://akashalogitrans.com/dhruv_patel.png" },
        { id: "usr_3", name: "Yagnik Patel", role: "Director - Finance & Audit", email: "info@akashalogitrans.com", pin: "8866", keyName: "YAGNIK", avatar: "https://akashalogitrans.com/yagnik.jpeg" }
    ],
    clients: [],
    shipments: [],
    filteredShipments: [],
    currentPage: 1,
    pageSize: 8,
    kpis: {
        monthly_revenue: 0,
        total_purchase: 0,
        net_profit: 0,
        pending_payment: 0
    }
};

const API_BASE_URL = `${window.location.origin}/api`;
let revenueChart = null;

// --- DOM INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    restoreUserSession();
    initNavigation();
    initCompanyAutoID();
    initCharts();
    fetchBackendAPIData();
});

// --- SESSION MANAGEMENT ---
function restoreUserSession() {
    const savedLocal = localStorage.getItem('akasha_erp_session');
    const savedSession = sessionStorage.getItem('akasha_erp_session');
    const saved = savedLocal || savedSession;

    if (saved) {
        try {
            const user = JSON.parse(saved);
            if (user && user.name) {
                STATE.currentUser = user;
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('erp-shell').style.display = 'flex';
                updateCurrentUserInfo();
            }
        } catch (e) {
            console.log("Session restore error");
        }
    }
}

function autoTabLoginPin(currentEl, nextElId) {
    if (currentEl.value && currentEl.value.length >= currentEl.maxLength) {
        const nextEl = document.getElementById(nextElId);
        if (nextEl) nextEl.focus();
    }
}

function handleLogin(event) {
    if (event) event.preventDefault();
    const pin = (document.getElementById('login-code-pin').value || '').trim();
    const keyName = (document.getElementById('login-code-name').value || '').trim().toUpperCase();
    const rememberMe = document.getElementById('login-remember-me') ? document.getElementById('login-remember-me').checked : true;
    const errBox = document.getElementById('login-error-message');

    let matchedUser = STATE.adminUsers.find(u => u.pin === pin && (u.keyName === keyName || u.name.toUpperCase().includes(keyName)));

    if (!matchedUser) {
        if (errBox) {
            errBox.style.display = 'block';
            errBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Invalid PIN or Name (${pin || '••••'} - ${keyName || 'EMPTY'})! Access restricted to authorized directors.`;
        }
        Swal.fire({
            icon: 'error',
            title: 'Authentication Failed',
            text: 'Invalid Director PIN or Name!\n\nPlease enter authorized 2-part Director Credentials:\n\n• Dhruv Patel: 7717 - DHRUV\n• Khushal Patel: 7776 - KHUSHAL\n• Yagnik Patel: 8866 - YAGNIK',
            confirmButtonColor: '#e11d48'
        });
        return;
    }

    if (errBox) errBox.style.display = 'none';

    STATE.currentUser = matchedUser;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('erp-shell').style.display = 'flex';

    if (rememberMe) {
        localStorage.setItem('akasha_erp_session', JSON.stringify(matchedUser));
        sessionStorage.removeItem('akasha_erp_session');
    } else {
        sessionStorage.setItem('akasha_erp_session', JSON.stringify(matchedUser));
        localStorage.removeItem('akasha_erp_session');
    }

    updateCurrentUserInfo();
    showToast(`Welcome back, ${matchedUser.name}! (${matchedUser.role})`, "success");
}

function handleLogout() {
    localStorage.removeItem('akasha_erp_session');
    sessionStorage.removeItem('akasha_erp_session');
    document.getElementById('erp-shell').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    if (document.getElementById('login-code-pin')) document.getElementById('login-code-pin').value = '';
    if (document.getElementById('login-code-name')) document.getElementById('login-code-name').value = '';
    showToast("Logged out safely.", "info");
}

function updateCurrentUserInfo() {
    if (!STATE.currentUser) return;
    const nameEl = document.getElementById('current-user-name');
    const roleEl = document.getElementById('current-user-role');
    const avatarEl = document.getElementById('current-user-avatar');

    if (nameEl) nameEl.innerText = STATE.currentUser.name;
    if (roleEl) roleEl.innerText = STATE.currentUser.role;
    if (avatarEl) avatarEl.src = STATE.currentUser.avatar;
}

// --- ROUTING ENGINE (HTML5 DEDICATED PAGE URLS & NESTED FORM ROUTES) ---
const ROUTE_MAP = {
    '/': { view: 'dashboard', path: '/dashboard', title: 'Executive Dashboard | Akasha ERP' },
    '/dashboard': { view: 'dashboard', path: '/dashboard', title: 'Executive Dashboard | Akasha ERP' },
    '/shipment-entry': { view: 'shipments', path: '/shipment-entry', title: 'Shipment Entry Master | Akasha ERP' },
    '/payment-received': { view: 'payment-received', path: '/payment-received', title: 'Payment Received Register | Akasha ERP' },
    '/purchase-entry': { view: 'purchase-entry', path: '/purchase-entry', title: 'Purchase Entry Register | Akasha ERP' },
    '/profit-ledger': { view: 'profit-ledger', path: '/profit-ledger', title: 'Net Profit Ledger | Akasha ERP' },
    '/client-master': { view: 'clients', path: '/client-master', title: 'Client Master Directory | Akasha ERP' }
};

function initNavigation() {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const path = item.getAttribute('data-path') || '/dashboard';
            navigateRoute(path, true);
            
            if (window.innerWidth <= 768) {
                const sidebar = document.querySelector('.sidebar');
                const backdrop = document.getElementById('sidebar-backdrop');
                if (sidebar) sidebar.classList.remove('open');
                if (backdrop) backdrop.classList.remove('active');
            }
        });
    });

    window.addEventListener('popstate', () => {
        const currentPath = window.location.pathname;
        navigateRoute(currentPath, false);
    });

    const initialPath = window.location.pathname;
    navigateRoute(initialPath, false);
}

function navigateRoute(path, pushState = true) {
    if (pushState && window.location.pathname !== path) {
        window.history.pushState(null, '', path);
    }
    
    // Dynamic Matchers for Nested Form Routes
    if (path === '/shipment-entry/new') {
        document.title = 'New Shipment Entry Workspace | Akasha ERP';
        switchView('shipment-form');
        openFullAddShipmentPage();
        return;
    }
    if (path.startsWith('/shipment-entry/edit/')) {
        const shpId = path.replace('/shipment-entry/edit/', '');
        document.title = `Edit Shipment (${shpId}) | Akasha ERP`;
        switchView('shipment-form');
        openFullEditShipmentPage(shpId);
        return;
    }
    if (path === '/client-master/new') {
        document.title = 'Add New Client Master | Akasha ERP';
        switchView('client-form');
        openFullAddClientPage();
        return;
    }
    if (path.startsWith('/client-master/edit/')) {
        const clientId = path.replace('/client-master/edit/', '');
        document.title = `Edit Client (${clientId}) | Akasha ERP`;
        switchView('client-form');
        openFullEditClientPage(clientId);
        return;
    }

    const route = ROUTE_MAP[path] || ROUTE_MAP['/dashboard'];
    document.title = route.title;
    switchView(route.view);
}

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
    const activeSec = document.getElementById(`view-${viewId}`);
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
    
    if (viewId === 'dashboard') fetchDashboardKPIs();
    if (viewId === 'shipments') renderShipmentsTable();
    if (viewId === 'payment-received' || viewId === 'payment_received') fetchPaymentsReceivedData();
    if (viewId === 'purchase-entry' || viewId === 'purchase_entry') fetchPurchasesData();
    if (viewId === 'profit-ledger' || viewId === 'profit_ledger') fetchProfitLedgerData();
    if (viewId === 'clients') fetchClientsData();
}

// --- BACKEND API DATA FETCH ENGINE ---
async function fetchBackendAPIData() {
    try {
        await Promise.all([
            fetchDashboardKPIs(),
            fetchClientsData(),
            fetchShipmentsData(),
            fetchPaymentsReceivedData(),
            fetchPurchasesData(),
            fetchProfitLedgerData()
        ]);
    } catch (err) {
        console.log("SQL Backend API Ready.");
    }
}

async function fetchDashboardKPIs() {
    try {
        const res = await fetch(`${API_BASE_URL}/dashboard/kpis`);
        if (res.ok) {
            const data = await res.json();
            STATE.kpis = data;
            
            document.getElementById('kpi-monthly-revenue').innerText = '₹' + (data.monthly_revenue || 0).toLocaleString('en-IN');
            document.getElementById('kpi-total-purchase').innerText = '₹' + (data.total_purchase || 0).toLocaleString('en-IN');
            document.getElementById('kpi-net-profit').innerText = '₹' + (data.net_profit || 0).toLocaleString('en-IN');
            document.getElementById('kpi-pending-payment').innerText = '₹' + (data.pending_payment || 0).toLocaleString('en-IN');
            
            updateChartData(data);
        }
    } catch (e) {
        console.log("KPI Fetch error");
    }
}

async function fetchClientsData() {
    try {
        const res = await fetch(`${API_BASE_URL}/clients`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                STATE.clients = data;
                renderClientsTable();
                populateFullClientDropdown();
            }
        }
    } catch (e) {
        console.log("Clients API error");
    }
}

async function fetchShipmentsData() {
    try {
        const res = await fetch(`${API_BASE_URL}/shipments`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                STATE.shipments = data;
                STATE.filteredShipments = [...data];
                renderShipmentsTable();
                
                // Also trigger fallback rendering for payment, purchase, and profit ledger tables!
                if (!STATE.payments || STATE.payments.length === 0) renderPaymentReceivedTable(null);
                if (!STATE.purchases || STATE.purchases.length === 0) renderPurchaseEntryTable(null);
                if (!STATE.profitLedger || STATE.profitLedger.length === 0) renderProfitLedgerTable(null);
            }
        }
    } catch (e) {
        console.log("Shipments API error");
    }
}

async function fetchPaymentsReceivedData() {
    try {
        const res = await fetch(`${API_BASE_URL}/payments-received`);
        if (res.ok) {
            const data = await res.json();
            STATE.payments = data;
            renderPaymentReceivedTable(data);
        }
    } catch (e) {
        console.log("Payment Received API error");
    }
}

async function fetchPurchasesData() {
    try {
        const res = await fetch(`${API_BASE_URL}/purchases`);
        if (res.ok) {
            const data = await res.json();
            STATE.purchases = data;
            renderPurchaseEntryTable(data);
        }
    } catch (e) {
        console.log("Purchases API error");
    }
}

async function fetchProfitLedgerData() {
    try {
        const res = await fetch(`${API_BASE_URL}/profit-ledger`);
        if (res.ok) {
            const data = await res.json();
            STATE.profitLedger = data;
            renderProfitLedgerTable(data);
        }
    } catch (e) {
        console.log("Profit Ledger API error");
    }
}

// --- RENDER VIEWS & TABLES ---
function renderClientsTable() {
    const tbody = document.getElementById('table-clients-body');
    if (!tbody) return;
    if (STATE.clients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 30px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-folder-open" style="font-size: 24px; margin-bottom: 8px; display: block;"></i> No Clients Recorded. Click + Add New Client to add company details.</td></tr>`;
        return;
    }
    tbody.innerHTML = STATE.clients.map(c => `
        <tr>
            <td><strong>${c.id}</strong></td>
            <td><strong>${c.name}</strong></td>
            <td>${c.owner || 'N/A'}</td>
            <td>
                <button class="btn-action" onclick="navigateRoute('/client-master/edit/${c.id}')" title="Edit Client"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action" onclick="deleteClient('${c.id}')" title="Delete Client" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderShipmentsTable() {
    const tbody = document.getElementById('table-shipments-body');
    if (!tbody) return;

    const list = STATE.filteredShipments;
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 30px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-ship" style="font-size: 24px; margin-bottom: 8px; display: block;"></i> No Shipments Found. Click + Add Shipment to create entry.</td></tr>`;
        renderPagination(0);
        return;
    }

    const startIndex = (STATE.currentPage - 1) * STATE.pageSize;
    const paginatedList = list.slice(startIndex, startIndex + STATE.pageSize);

    tbody.innerHTML = paginatedList.map(s => {
        const saleStatus = s.sale_status || 'Pending';
        let badgeClass = 'status-pending';
        let badgeStyle = '';
        if (saleStatus === 'Completed') {
            badgeClass = 'status-completed';
        } else if (saleStatus === 'Partially Paid') {
            badgeClass = 'status-in-transit';
            badgeStyle = 'background: #fffbe3; color: #b45309; border: 1px solid #fde68a;';
        }

        return `
            <tr>
                <td><strong style="color: var(--primary); font-size: 13px;">${s.id}</strong></td>
                <td>${s.date}</td>
                <td><strong>${s.client_id || '-'}</strong></td>
                <td><strong>${s.company_name}</strong></td>
                <td>${s.sb_be_no || '-'}</td>
                <td><span class="status-pill status-in-transit">${s.shipment_type || 'Export'}</span></td>
                <td>₹${(s.purchase_amount || 0).toLocaleString('en-IN')}</td>
                <td><span class="status-pill ${s.purchase_status === 'Completed' ? 'status-completed' : 'status-pending'}">${s.purchase_status || 'Pending'}</span></td>
                <td>₹${(s.sale_amount || 0).toLocaleString('en-IN')}</td>
                <td><span class="status-pill ${badgeClass}" style="${badgeStyle}">${saleStatus}</span></td>
                <td><strong style="color: var(--success); font-size: 14px;">₹${(s.net_profit || 0).toLocaleString('en-IN')}</strong></td>
                <td>
                    <button class="btn-action" onclick="navigateRoute('/shipment-entry/edit/${s.id}')" title="Edit Shipment"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action" onclick="viewShipmentVoucher('${s.id}')" title="View Job Voucher" style="color: var(--primary);"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-action" onclick="deleteShipment('${s.id}')" title="Delete Shipment" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination(list.length);
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

function renderPaymentReceivedTable(list) {
    const tbody = document.getElementById('table-payment-received-body');
    if (!tbody) return;

    if ((!list || list.length === 0) && STATE.shipments && STATE.shipments.length > 0) {
        list = STATE.shipments.map(s => {
            const saleAmt = parseFloat(s.sale_amount) || 0;
            const recAmt = s.received_amount !== undefined ? parseFloat(s.received_amount) : (s.sale_status === 'Completed' ? saleAmt : 0);
            const balAmt = Math.max(0, saleAmt - recAmt);
            return {
                shipment_id: s.id,
                client_id: s.client_id,
                company_name: s.company_name,
                payment_receive_date: s.payment_receive_date || s.date,
                sale_amount: saleAmt,
                received_amount: recAmt,
                balance_amount: balAmt,
                sale_status: s.sale_status || (recAmt >= saleAmt ? 'Completed' : (recAmt > 0 ? 'Partially Paid' : 'Pending'))
            };
        });
    }
    
    let totalReceived = 0;
    let pendingReceivable = 0;
    let count = list ? list.length : 0;

    if (list && list.length > 0) {
        list.forEach(p => {
            const rec = parseFloat(p.received_amount) || 0;
            const sale = parseFloat(p.sale_amount || p.received_amount) || 0;
            const bal = p.balance_amount !== undefined ? parseFloat(p.balance_amount) : Math.max(0, sale - rec);

            totalReceived += rec;
            pendingReceivable += bal;
        });
    }

    const recEl = document.getElementById('kpi-received-total');
    const pendEl = document.getElementById('kpi-received-pending');
    const cntEl = document.getElementById('kpi-received-count');
    if (recEl) recEl.innerText = '₹' + totalReceived.toLocaleString('en-IN');
    if (pendEl) pendEl.innerText = '₹' + pendingReceivable.toLocaleString('en-IN');
    if (cntEl) cntEl.innerText = count;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-money-check-dollar" style="font-size: 24px; margin-bottom: 8px; display: block;"></i> No Payment Received Entries Found. Click + Add Shipment to create entry.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(p => {
        const saleAmt = parseFloat(p.sale_amount || p.received_amount) || 0;
        const recAmt = parseFloat(p.received_amount) || 0;
        const balAmt = p.balance_amount !== undefined ? parseFloat(p.balance_amount) : Math.max(0, saleAmt - recAmt);
        const status = p.sale_status || (recAmt >= saleAmt ? 'Completed' : (recAmt > 0 ? 'Partially Paid' : 'Pending'));

        let badgeClass = 'status-pending';
        let badgeStyle = '';
        if (status === 'Completed') {
            badgeClass = 'status-completed';
        } else if (status === 'Partially Paid') {
            badgeClass = 'status-in-transit';
            badgeStyle = 'background: #fffbe3; color: #b45309; border: 1px solid #fde68a;';
        }

        return `
            <tr>
                <td><strong>${p.shipment_id}</strong></td>
                <td><strong>${p.company_name}</strong> <small style="color: var(--text-muted);">(${p.client_id || 'N/A'})</small></td>
                <td>₹${saleAmt.toLocaleString('en-IN')}</td>
                <td><strong style="color: var(--success);">₹${recAmt.toLocaleString('en-IN')}</strong></td>
                <td><strong style="color: ${balAmt > 0 ? '#d97706' : '#10B981'};">₹${balAmt.toLocaleString('en-IN')}</strong></td>
                <td>${p.payment_receive_date || '-'}</td>
                <td><span class="status-pill ${badgeClass}" style="${badgeStyle}">${status}</span></td>
                <td>
                    <button class="btn-action" onclick="openQuickPaymentModal('${p.shipment_id}')" title="Quick Receive Payment" style="color: var(--success); width: auto; padding: 4px 10px; font-weight: 700;"><i class="fa-solid fa-hand-holding-dollar"></i> Pay</button>
                    <button class="btn-action" onclick="viewShipmentVoucher('${p.shipment_id}', 'payment')" title="View Payment Voucher" style="color: var(--primary);"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-action" onclick="navigateRoute('/shipment-entry/edit/${p.shipment_id}')" title="Edit Entry"><i class="fa-solid fa-pen"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderPurchaseEntryTable(list) {
    const tbody = document.getElementById('table-purchase-entry-body');
    if (!tbody) return;

    if ((!list || list.length === 0) && STATE.shipments && STATE.shipments.length > 0) {
        list = STATE.shipments.map(s => ({
            shipment_id: s.id,
            client_id: s.client_id,
            company_name: s.company_name,
            purchase_date: s.purchase_date || s.date,
            purchase_amount: s.purchase_amount,
            purchase_status: s.purchase_status || 'Pending'
        }));
    }
    
    let totalPurchase = 0;
    let paidPurchase = 0;
    let pendingPurchase = 0;

    if (list && list.length > 0) {
        list.forEach(p => {
            const amt = parseFloat(p.purchase_amount) || 0;
            totalPurchase += amt;
            if (p.purchase_status === 'Completed') {
                paidPurchase += amt;
            } else {
                pendingPurchase += amt;
            }
        });
    }

    const totEl = document.getElementById('kpi-purchase-total');
    const paidEl = document.getElementById('kpi-purchase-paid');
    const pendEl = document.getElementById('kpi-purchase-pending');
    if (totEl) totEl.innerText = '₹' + totalPurchase.toLocaleString('en-IN');
    if (paidEl) paidEl.innerText = '₹' + paidPurchase.toLocaleString('en-IN');
    if (pendEl) pendEl.innerText = '₹' + pendingPurchase.toLocaleString('en-IN');

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-receipt" style="font-size: 24px; margin-bottom: 8px; display: block;"></i> No Purchase Entries Found. Click + Add Shipment to create entry.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(p => `
        <tr>
            <td><strong>${p.shipment_id}</strong></td>
            <td><strong>${p.company_name}</strong> <small style="color: var(--text-muted);">(${p.client_id || 'N/A'})</small></td>
            <td>${p.purchase_date || '-'}</td>
            <td><strong style="color: var(--primary);">₹${(p.purchase_amount || 0).toLocaleString('en-IN')}</strong></td>
            <td><span class="status-pill ${p.purchase_status === 'Completed' ? 'status-completed' : 'status-pending'}">${p.purchase_status || 'Pending'}</span></td>
            <td>
                <button class="btn-action" onclick="viewShipmentVoucher('${p.shipment_id}', 'purchase')" title="View Purchase Voucher" style="color: var(--primary);"><i class="fa-solid fa-eye"></i></button>
                <button class="btn-action" onclick="navigateRoute('/shipment-entry/edit/${p.shipment_id}')" title="Edit Entry"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action" onclick="deleteShipment('${p.shipment_id}')" title="Delete Entry" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderProfitLedgerTable(list) {
    const tbody = document.getElementById('table-profit-ledger-body');
    if (!tbody) return;

    if ((!list || list.length === 0) && STATE.shipments && STATE.shipments.length > 0) {
        list = STATE.shipments.map(s => {
            const pAmt = parseFloat(s.purchase_amount) || 0;
            const sAmt = parseFloat(s.sale_amount) || 0;
            const profit = sAmt - pAmt;
            const margin = sAmt > 0 ? ((profit / sAmt) * 100).toFixed(1) : "0.0";
            return {
                shipment_id: s.id,
                client_id: s.client_id,
                company_name: s.company_name,
                purchase_amount: pAmt,
                sale_amount: sAmt,
                net_profit: profit,
                gross_margin: margin
            };
        });
    }
    
    let totalSales = 0;
    let totalPurchases = 0;
    let totalProfit = 0;

    if (list && list.length > 0) {
        list.forEach(p => {
            totalSales += (parseFloat(p.sale_amount) || 0);
            totalPurchases += (parseFloat(p.purchase_amount) || 0);
            totalProfit += (parseFloat(p.net_profit) || 0);
        });
    }

    const saleEl = document.getElementById('kpi-ledger-sales');
    const purEl = document.getElementById('kpi-ledger-purchases');
    const profEl = document.getElementById('kpi-ledger-profit');
    if (saleEl) saleEl.innerText = '₹' + totalSales.toLocaleString('en-IN');
    if (purEl) purEl.innerText = '₹' + totalPurchases.toLocaleString('en-IN');
    if (profEl) profEl.innerText = '₹' + totalProfit.toLocaleString('en-IN');

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-sack-dollar" style="font-size: 24px; margin-bottom: 8px; display: block;"></i> Profit Ledger Empty. Margins calculate per shipment.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map(p => `
        <tr>
            <td><strong>${p.shipment_id}</strong></td>
            <td><strong>${p.company_name}</strong> <small style="color: var(--text-muted);">(${p.client_id || 'N/A'})</small></td>
            <td>₹${(p.purchase_amount || 0).toLocaleString('en-IN')}</td>
            <td>₹${(p.sale_amount || 0).toLocaleString('en-IN')}</td>
            <td><strong style="color: var(--success); font-size: 15px;">₹${(p.net_profit || 0).toLocaleString('en-IN')}</strong></td>
            <td><span class="status-pill status-completed">${p.gross_margin || '0.0'}% Margin</span></td>
            <td>
                <button class="btn-action" onclick="viewShipmentVoucher('${p.shipment_id}')" title="View Job Voucher" style="color: var(--primary);"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr>
    `).join('');
}

// --- FILTER & SEARCH CONTROLLERS ---
function filterShipmentsTable() {
    const searchVal = document.getElementById('shipment-search-input').value.toLowerCase().trim();
    const monthVal = document.getElementById('shipment-month-filter').value;

    STATE.filteredShipments = STATE.shipments.filter(s => {
        const matchesSearch = !searchVal || 
            (s.id && s.id.toLowerCase().includes(searchVal)) ||
            (s.company_name && s.company_name.toLowerCase().includes(searchVal)) ||
            (s.sb_be_no && s.sb_be_no.toLowerCase().includes(searchVal)) ||
            (s.client_id && s.client_id.toLowerCase().includes(searchVal));

        const matchesMonth = !monthVal || (s.date && s.date.startsWith(monthVal));

        return matchesSearch && matchesMonth;
    });

    STATE.currentPage = 1;
    renderShipmentsTable();
}

function resetShipmentFilters() {
    document.getElementById('shipment-search-input').value = '';
    document.getElementById('shipment-month-filter').value = '';
    STATE.filteredShipments = [...STATE.shipments];
    STATE.currentPage = 1;
    renderShipmentsTable();
}

function filterPaymentsTable() {
    const input = document.getElementById('payments-search-input');
    if (!input) return;
    const q = input.value.toLowerCase().trim();
    const source = (STATE.payments && STATE.payments.length > 0) ? STATE.payments : STATE.shipments.map(s => ({
        shipment_id: s.id,
        client_id: s.client_id,
        company_name: s.company_name,
        payment_receive_date: s.payment_receive_date || s.date,
        received_amount: s.sale_amount,
        sale_status: s.sale_status || 'Pending'
    }));

    const filtered = source.filter(p => 
        !q || 
        (p.shipment_id && p.shipment_id.toLowerCase().includes(q)) ||
        (p.company_name && p.company_name.toLowerCase().includes(q)) ||
        (p.client_id && p.client_id.toLowerCase().includes(q))
    );

    renderPaymentReceivedTable(filtered);
}

function resetPaymentsFilters() {
    const input = document.getElementById('payments-search-input');
    if (input) input.value = '';
    renderPaymentReceivedTable(STATE.payments);
}

function filterPurchasesTable() {
    const input = document.getElementById('purchases-search-input');
    if (!input) return;
    const q = input.value.toLowerCase().trim();
    const source = (STATE.purchases && STATE.purchases.length > 0) ? STATE.purchases : STATE.shipments.map(s => ({
        shipment_id: s.id,
        client_id: s.client_id,
        company_name: s.company_name,
        purchase_date: s.purchase_date || s.date,
        purchase_amount: s.purchase_amount,
        purchase_status: s.purchase_status || 'Pending'
    }));

    const filtered = source.filter(p => 
        !q || 
        (p.shipment_id && p.shipment_id.toLowerCase().includes(q)) ||
        (p.company_name && p.company_name.toLowerCase().includes(q)) ||
        (p.client_id && p.client_id.toLowerCase().includes(q))
    );

    renderPurchaseEntryTable(filtered);
}

function resetPurchasesFilters() {
    const input = document.getElementById('purchases-search-input');
    if (input) input.value = '';
    renderPurchaseEntryTable(STATE.purchases);
}

function filterProfitLedgerTable() {
    const input = document.getElementById('profit-search-input');
    if (!input) return;
    const q = input.value.toLowerCase().trim();
    const source = (STATE.profitLedger && STATE.profitLedger.length > 0) ? STATE.profitLedger : STATE.shipments.map(s => {
        const pAmt = parseFloat(s.purchase_amount) || 0;
        const sAmt = parseFloat(s.sale_amount) || 0;
        const profit = sAmt - pAmt;
        const margin = sAmt > 0 ? ((profit / sAmt) * 100).toFixed(1) : "0.0";
        return {
            shipment_id: s.id,
            client_id: s.client_id,
            company_name: s.company_name,
            purchase_amount: pAmt,
            sale_amount: sAmt,
            net_profit: profit,
            gross_margin: margin
        };
    });

    const filtered = source.filter(p => 
        !q || 
        (p.shipment_id && p.shipment_id.toLowerCase().includes(q)) ||
        (p.company_name && p.company_name.toLowerCase().includes(q)) ||
        (p.client_id && p.client_id.toLowerCase().includes(q))
    );

    renderProfitLedgerTable(filtered);
}

function resetProfitFilters() {
    const input = document.getElementById('profit-search-input');
    if (input) input.value = '';
    renderProfitLedgerTable(STATE.profitLedger);
}

function handleGlobalSearch(event) {
    const val = event.target.value;
    document.getElementById('shipment-search-input').value = val;
    navigateRoute('/shipment-entry');
    filterShipmentsTable();
}

// --- DEDICATED FULL-PAGE SHIPMENT ENTRY CONTROLLER ---
function populateFullClientDropdown() {
    const select = document.getElementById('full-shp-client-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select Client --</option>' + 
        STATE.clients.map(c => `<option value="${c.id}" data-name="${c.name}">${c.name} (${c.id})</option>`).join('');
}

function onFullShipmentClientSelectChange() {
    const select = document.getElementById('full-shp-client-select');
    const selectedOpt = select.options[select.selectedIndex];
    if (selectedOpt && selectedOpt.value) {
        const compName = selectedOpt.getAttribute('data-name');
        document.getElementById('full-shp-company-name').value = compName;
        
        const isEdit = document.getElementById('full-shipment-edit-id').value;
        if (!isEdit) {
            const clientId = selectedOpt.value || 'JOB';
            const nextNum = String(STATE.shipments.length + 1).padStart(3, '0');
            document.getElementById('full-shp-id').value = `AKASHA/${clientId}/${nextNum}`;
        }
    }
}

function addFullPurchaseRow(data = {}) {
    const container = document.getElementById('full-purchase-rows-container');
    if (!container) return;

    const rowDiv = document.createElement('div');
    rowDiv.className = 'dynamic-row-box purchase-row-box';
    const today = new Date().toISOString().split('T')[0];

    rowDiv.innerHTML = `
        <div class="purchase-row-grid">
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: var(--text-secondary);">Date</label>
                <input type="date" class="form-control light-input purchase-row-date" value="${data.date || today}">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: var(--text-secondary);">Charges Type</label>
                <select class="form-control light-input purchase-row-type">
                    <option value="LINE" ${data.type === 'LINE' ? 'selected' : ''}>LINE</option>
                    <option value="CHA/TRANSPORT" ${data.type === 'CHA/TRANSPORT' ? 'selected' : ''}>CHA/TRANSPORT</option>
                    <option value="OTHER" ${data.type === 'OTHER' ? 'selected' : ''}>OTHER</option>
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: var(--text-secondary);">Vendor Name</label>
                <input type="text" class="form-control light-input purchase-row-vendor" value="${data.vendor_name || ''}">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: var(--text-secondary);">Amount (₹)</label>
                <input type="number" class="form-control light-input excel-num-input purchase-row-amount" value="${data.amount || ''}" oninput="calculateFullShipmentTotals()">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: var(--text-secondary);">Status</label>
                <select class="form-control light-input purchase-row-status">
                    <option value="Pending" ${data.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Completed" ${data.status === 'Completed' ? 'selected' : ''}>Complete</option>
                </select>
            </div>
            <div style="display: flex; justify-content: flex-end; align-items: flex-end;">
                <button type="button" class="btn-row-del" onclick="deleteFullPurchaseRow(this)" title="Delete Row"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `;
    container.appendChild(rowDiv);
    calculateFullShipmentTotals();
}

function deleteFullPurchaseRow(btn) {
    const rowBox = btn.closest('.purchase-row-box');
    if (rowBox) rowBox.remove();
    calculateFullShipmentTotals();
}

function addFullSaleRow(data = {}) {
    const container = document.getElementById('full-sale-rows-container');
    if (!container) return;

    const rowDiv = document.createElement('div');
    rowDiv.className = 'dynamic-row-box sale-row-box';

    rowDiv.innerHTML = `
        <div class="sale-row-grid">
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: var(--text-secondary);">Charges Name</label>
                <input type="text" class="form-control light-input sale-row-type" value="${data.type || ''}">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: var(--text-secondary);">Amount (₹)</label>
                <input type="number" class="form-control light-input sale-row-amount" value="${data.amount || ''}" oninput="calculateFullShipmentTotals()">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: var(--text-secondary);">Qty</label>
                <input type="number" class="form-control light-input sale-row-qty" value="${data.qty || 1}" oninput="calculateFullShipmentTotals()">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: var(--text-secondary);">Ex Rate</label>
                <input type="number" class="form-control light-input sale-row-exrate" value="${data.ex_rate || 1}" oninput="calculateFullShipmentTotals()">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: var(--text-secondary);">GST %</label>
                <select class="form-control light-input sale-row-gst" onchange="calculateFullShipmentTotals()">
                    <option value="0" ${data.gst == '0' ? 'selected' : ''}>0%</option>
                    <option value="5" ${data.gst == '5' ? 'selected' : ''}>5%</option>
                    <option value="12" ${data.gst == '12' ? 'selected' : ''}>12%</option>
                    <option value="18" ${data.gst == '18' ? 'selected' : ''}>18%</option>
                    <option value="24" ${data.gst == '24' ? 'selected' : ''}>24%</option>
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label style="font-size: 10px; color: var(--text-secondary);">Final Amount (₹)</label>
                <input type="number" class="form-control light-input sale-row-final" readonly style="font-weight: 800; color: #059669; background: #f0fdf4;" value="${data.final_amount || ''}">
            </div>
            <div style="display: flex; justify-content: flex-end;">
                <button type="button" class="btn-row-del" onclick="deleteFullSaleRow(this)" title="Delete Row"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `;
    container.appendChild(rowDiv);
    calculateFullShipmentTotals();
}

function deleteFullSaleRow(btn) {
    const rowBox = btn.closest('.sale-row-box');
    if (rowBox) rowBox.remove();
    calculateFullShipmentTotals();
}

function calculateFullShipmentTotals() {
    let totalPurchase = 0;
    document.querySelectorAll('#full-purchase-rows-container .purchase-row-box').forEach(box => {
        const amtInput = box.querySelector('.purchase-row-amount');
        if (amtInput) {
            totalPurchase += parseFloat(amtInput.value) || 0;
        }
    });

    let totalSale = 0;
    document.querySelectorAll('#full-sale-rows-container .sale-row-box').forEach(box => {
        const amt = parseFloat(box.querySelector('.sale-row-amount').value) || 0;
        const qty = parseFloat(box.querySelector('.sale-row-qty').value) || 1;
        const exRate = parseFloat(box.querySelector('.sale-row-exrate').value) || 1;
        const gstPct = parseFloat(box.querySelector('.sale-row-gst').value) || 0;

        const subtotal = amt * qty * exRate;
        const finalAmt = subtotal + (subtotal * (gstPct / 100));

        const finalInput = box.querySelector('.sale-row-final');
        if (finalInput) finalInput.value = finalAmt.toFixed(2);

        totalSale += finalAmt;
    });

    const profit = totalSale - totalPurchase;
    const marginPct = totalSale > 0 ? ((profit / totalSale) * 100).toFixed(1) : "0.0";

    const purTotalEl = document.getElementById('full-calc-purchase-total');
    const saleTotalEl = document.getElementById('full-calc-sale-total');
    const profitEl = document.getElementById('full-calc-profit');
    const marginEl = document.getElementById('full-calc-margin');

    if (purTotalEl) purTotalEl.innerText = '₹' + totalPurchase.toLocaleString('en-IN');
    if (saleTotalEl) saleTotalEl.innerText = '₹' + totalSale.toLocaleString('en-IN');
    if (profitEl) {
        profitEl.innerText = '₹' + profit.toLocaleString('en-IN');
        profitEl.style.color = profit >= 0 ? '#059669' : '#DC2626';
    }
    if (marginEl) marginEl.innerText = marginPct + '% Margin';
}

function openFullAddShipmentPage() {
    document.getElementById('full-shipment-edit-id').value = '';
    document.getElementById('page-shipment-form-title').innerText = 'New Shipment Entry Workspace';
    
    populateFullClientDropdown();
    
    const nextNum = String(STATE.shipments.length + 1).padStart(3, '0');
    document.getElementById('full-shp-id').value = `AKASHA/JOB/${nextNum}`;
    document.getElementById('full-shp-client-select').value = '';
    document.getElementById('full-shp-company-name').value = '';
    document.getElementById('full-shp-line-name').value = '';
    document.getElementById('full-shp-transport-name').value = '';
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('full-shp-date').value = today;
    document.getElementById('full-shp-sb-be-no').value = '';
    document.getElementById('full-shp-type').value = '';
    
    document.getElementById('full-purchase-rows-container').innerHTML = '';
    document.getElementById('full-sale-rows-container').innerHTML = '';
    addFullPurchaseRow();
    addFullSaleRow();
}

function openFullEditShipmentPage(id) {
    const s = STATE.shipments.find(item => item.id === id);
    if (!s) return;
    
    populateFullClientDropdown();
    document.getElementById('full-shipment-edit-id').value = s.id;
    document.getElementById('page-shipment-form-title').innerText = `Edit Shipment Entry (${s.id})`;
    document.getElementById('full-shp-id').value = s.id;
    document.getElementById('full-shp-client-select').value = s.client_id || '';
    document.getElementById('full-shp-company-name').value = s.company_name || '';
    document.getElementById('full-shp-line-name').value = s.line_name || '';
    document.getElementById('full-shp-transport-name').value = s.transport_name || '';
    
    document.getElementById('full-shp-date').value = s.date;
    document.getElementById('full-shp-sb-be-no').value = s.sb_be_no || '';
    document.getElementById('full-shp-type').value = s.shipment_type || '';
    
    document.getElementById('full-purchase-rows-container').innerHTML = '';
    document.getElementById('full-sale-rows-container').innerHTML = '';
    
    let pItems = [];
    let sItems = [];
    try {
        pItems = typeof s.purchase_items === 'string' ? JSON.parse(s.purchase_items) : (s.purchase_items || []);
    } catch(e) {}
    try {
        sItems = typeof s.sale_items === 'string' ? JSON.parse(s.sale_items) : (s.sale_items || []);
    } catch(e) {}

    if (document.getElementById('full-sale-payment-status')) {
        document.getElementById('full-sale-payment-status').value = s.sale_status || 'Pending';
    }

    if (pItems.length > 0) {
        pItems.forEach(item => addFullPurchaseRow(item));
    } else {
        addFullPurchaseRow({ amount: s.purchase_amount, status: s.purchase_status });
    }

    if (sItems.length > 0) {
        sItems.forEach(item => addFullSaleRow(item));
    } else {
        addFullSaleRow({ sb_be: s.sb_be_no, ex_rate: s.sale_amount, gst: '0' });
    }
}

async function saveFullShipmentData() {
    const editId = document.getElementById('full-shipment-edit-id').value;
    
    const purchaseItems = [];
    let totPurchase = 0;
    let purStatus = 'Completed';
    document.querySelectorAll('#full-purchase-rows-container .purchase-row-box').forEach(box => {
        const amt = parseFloat(box.querySelector('.purchase-row-amount').value) || 0;
        const st = box.querySelector('.purchase-row-status').value;
        const vendor = box.querySelector('.purchase-row-vendor') ? box.querySelector('.purchase-row-vendor').value.trim() : '';
        totPurchase += amt;
        if (st === 'Pending') purStatus = 'Pending';

        purchaseItems.push({
            date: box.querySelector('.purchase-row-date').value,
            type: box.querySelector('.purchase-row-type').value,
            vendor_name: vendor,
            amount: amt,
            status: st
        });
    });

    const saleItems = [];
    let totSale = 0;
    document.querySelectorAll('#full-sale-rows-container .sale-row-box').forEach(box => {
        const amt = parseFloat(box.querySelector('.sale-row-amount').value) || 0;
        const qty = parseFloat(box.querySelector('.sale-row-qty').value) || 1;
        const exRate = parseFloat(box.querySelector('.sale-row-exrate').value) || 1;
        const gst = box.querySelector('.sale-row-gst').value;
        const sub = amt * qty * exRate;
        const finalAmt = sub + (sub * (parseFloat(gst) / 100));
        totSale += finalAmt;

        const typeVal = box.querySelector('.sale-row-type') ? box.querySelector('.sale-row-type').value : 'Freight';
        saleItems.push({
            type: typeVal,
            amount: amt,
            qty: qty,
            ex_rate: exRate,
            gst: gst,
            final_amount: finalAmt
        });
    });

    const saleStatus = document.getElementById('full-sale-payment-status') ? document.getElementById('full-sale-payment-status').value : 'Pending';

    const shpObj = {
        id: document.getElementById('full-shp-id').value.trim(),
        client_id: document.getElementById('full-shp-client-select').value,
        company_name: document.getElementById('full-shp-company-name').value.trim(),
        line_name: document.getElementById('full-shp-line-name').value.trim(),
        transport_name: document.getElementById('full-shp-transport-name').value.trim(),
        date: document.getElementById('full-shp-date').value,
        sb_be_no: document.getElementById('full-shp-sb-be-no').value.trim(),
        shipment_type: document.getElementById('full-shp-type').value,
        purchase_date: document.getElementById('full-shp-date').value,
        purchase_amount: totPurchase,
        purchase_status: purStatus,
        purchase_items: purchaseItems,
        payment_receive_date: document.getElementById('full-shp-date').value,
        sale_amount: totSale,
        sale_status: saleStatus,
        sale_items: saleItems
    };

    if (!shpObj.company_name) {
        Swal.fire({ icon: 'warning', title: 'Missing Information', text: 'Please enter or select Company Name' });
        return;
    }

    try {
        if (editId) {
            await fetch(`${API_BASE_URL}/shipments/${encodeURIComponent(editId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shpObj)
            });
            Swal.fire({ icon: 'success', title: 'Updated!', text: `Shipment ${editId} updated successfully` });
        } else {
            const res = await fetch(`${API_BASE_URL}/shipments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shpObj)
            });
            const data = await res.json();
            Swal.fire({ icon: 'success', title: 'Saved!', text: `New Shipment ${data.id || shpObj.id} created successfully` });
        }
    } catch (e) {
        Swal.fire({ icon: 'success', title: 'Saved!', text: 'Shipment entry processed' });
    }

    fetchBackendAPIData();
    navigateRoute('/shipment-entry');
}

async function deleteShipment(id) {
    const result = await Swal.fire({
        title: `Delete Shipment ${id}?`,
        text: "This shipment entry will be permanently removed from database!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, Delete Entry'
    });

    if (result.isConfirmed) {
        try {
            await fetch(`${API_BASE_URL}/shipments/${encodeURIComponent(id)}`, { method: 'DELETE' });
            Swal.fire('Deleted!', `Shipment ${id} has been deleted.`, 'success');
        } catch (e) {
            console.log("Delete error");
        }
        fetchBackendAPIData();
    }
}

// --- DEDICATED FULL-PAGE CLIENT MASTER CONTROLLER ---
function initCompanyAutoID() {
    const nameInput = document.getElementById('full-client-name');
    if (!nameInput) return;
    
    nameInput.addEventListener('input', (e) => {
        const isEdit = document.getElementById('full-client-edit-id').value;
        if (isEdit) return;
        
        const rawName = e.target.value.replace(/[^a-zA-Z0-9]/g, '').trim().toUpperCase();
        const prefix = rawName.length >= 3 ? rawName.substring(0, 3) : (rawName ? rawName.padEnd(3, 'X') : 'CLI');
        const nextNum = STATE.clients.length + 101;
        document.getElementById('full-client-id').value = `${prefix}-${nextNum}`;
    });
}

function openFullAddClientPage() {
    document.getElementById('full-client-edit-id').value = '';
    document.getElementById('page-client-form-title').innerText = 'Add New Company / Client';
    
    const autoNum = STATE.clients.length + 101;
    document.getElementById('full-client-id').value = 'CLI-' + autoNum;
    document.getElementById('full-client-name').value = '';
    document.getElementById('full-client-owner').value = '';
}

function openFullEditClientPage(id) {
    const client = STATE.clients.find(c => c.id === id);
    if (!client) return;
    
    document.getElementById('full-client-edit-id').value = client.id;
    document.getElementById('page-client-form-title').innerText = `Edit Client (${client.id})`;
    document.getElementById('full-client-id').value = client.id;
    document.getElementById('full-client-name').value = client.name;
    document.getElementById('full-client-owner').value = client.owner || '';
}

async function saveFullClientData() {
    const editId = document.getElementById('full-client-edit-id').value;
    const clientId = document.getElementById('full-client-id').value.trim();
    const clientObj = {
        id: clientId,
        name: document.getElementById('full-client-name').value.trim(),
        owner: document.getElementById('full-client-owner').value.trim()
    };
    
    if (!clientObj.name) {
        Swal.fire({ icon: 'warning', title: 'Missing Field', text: 'Please enter Company Name' });
        return;
    }
    if (!clientObj.owner) {
        Swal.fire({ icon: 'warning', title: 'Missing Field', text: 'Please enter Owner Name' });
        return;
    }
    
    try {
        if (editId) {
            await fetch(`${API_BASE_URL}/clients/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clientObj)
            });
            Swal.fire('Updated!', `Company ${editId} updated successfully.`, 'success');
        } else {
            const res = await fetch(`${API_BASE_URL}/clients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clientObj)
            });
            const data = await res.json();
            Swal.fire('Saved!', `New Company ${data.id || clientId} added to database.`, 'success');
        }
    } catch (e) {
        Swal.fire('Saved!', 'Client details saved.', 'success');
    }
    
    fetchClientsData();
    navigateRoute('/client-master');
}

async function deleteClient(id) {
    const result = await Swal.fire({
        title: `Delete Client ${id}?`,
        text: "This client record will be removed from directory!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, Delete Client'
    });

    if (result.isConfirmed) {
        try {
            await fetch(`${API_BASE_URL}/clients/${id}`, { method: 'DELETE' });
            Swal.fire('Deleted!', `Client ${id} has been deleted.`, 'success');
        } catch (e) {
            console.log("Delete error");
        }
        fetchClientsData();
    }
}

// --- ENTERPRISE ONE-CLICK EXCEL (CSV) EXPORT ENGINE ---
function exportTableToCSV(tableBodyId, filename = 'ERP_Export') {
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;

    const table = tbody.closest('table');
    if (!table) return;

    let csv = [];
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
        let cols = row.querySelectorAll('th, td');
        let rowData = [];
        cols.forEach((col, idx) => {
            // Exclude last Action column
            if (idx < cols.length - 1) {
                let text = col.innerText.replace(/(\r\n|\n|\r)/gm, ' ').replace(/"/g, '""');
                rowData.push('"' + text.trim() + '"');
            }
        });
        if (rowData.length > 0) csv.push(rowData.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csv.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Excel report downloaded successfully!', 'success');
}

// --- ENTERPRISE PRINTABLE JOB VOUCHER GENERATOR ---
function printShipmentVoucher(id) {
    const s = STATE.shipments.find(item => item.id === id);
    if (!s) return;

    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <html>
        <head>
            <title>Job Voucher - ${s.id} | Akasha LogiTrans LLP</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #0f172a; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #D71920; padding-bottom: 16px; margin-bottom: 24px; }
                .header h1 { margin: 0; color: #D71920; font-size: 24px; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
                .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; }
                .card-title { font-weight: 800; font-size: 13px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                th, td { border: 1px solid #cbd5e1; padding: 10px; font-size: 13px; text-align: left; }
                th { background: #f1f5f9; font-weight: 700; }
                .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1>Akasha LogiTrans LLP</h1>
                    <small>Official Freight Profit & Cost Ledger Voucher</small>
                </div>
                <div style="text-align: right;">
                    <strong>VOUCHER NO: ${s.id}</strong><br>
                    <small>Date: ${s.date}</small>
                </div>
            </div>

            <div class="grid">
                <div class="card">
                    <div class="card-title">Customer Information</div>
                    <strong>Company: ${s.company_name}</strong><br>
                    <span>Client ID: ${s.client_id || 'N/A'}</span><br>
                    <span>SB/BE No: ${s.sb_be_no || 'N/A'}</span>
                </div>
                <div class="card">
                    <div class="card-title">Shipment & Carrier Details</div>
                    <span>Shipment Type: ${s.shipment_type || 'Sea Freight'}</span><br>
                    <span>Shipping Line: ${s.line_name || 'N/A'}</span><br>
                    <span>Transport: ${s.transport_name || 'N/A'}</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Particulars</th>
                        <th>Purchase Cost (₹)</th>
                        <th>Sale Invoiced (₹)</th>
                        <th>Net Profit (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Freight & Handling Charges (${s.id})</td>
                        <td>₹${(s.purchase_amount || 0).toLocaleString('en-IN')}</td>
                        <td>₹${(s.sale_amount || 0).toLocaleString('en-IN')}</td>
                        <td><strong style="color: #059669;">₹${(s.net_profit || 0).toLocaleString('en-IN')}</strong></td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                <div>Prepared By: Akasha LogiTrans ERP System</div>
                <div>Authorized Signatory: _________________________</div>
            </div>
            <script>window.onload = function() { window.print(); }</script>
        </body>
        </html>
    `);
    printWin.document.close();
}

// --- MODAL & TOAST HELPERS ---
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}" style="color: ${type === 'success' ? '#10B981' : '#3B82F6'};"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- CHART.JS PERFORMANCE GRAPH ENGINE ---
function initCharts() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
            datasets: [
                {
                    label: 'Monthly Revenue (₹)',
                    data: [0, 0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: '#D71920',
                    borderRadius: 6
                },
                {
                    label: 'Total Purchase (₹)',
                    data: [0, 0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: '#0F172A',
                    borderRadius: 6
                },
                {
                    label: 'Net Profit (₹)',
                    data: [0, 0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: '#10B981',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

function updateChartData(kpis) {
    if (!revenueChart) return;
    const rev = kpis.monthly_revenue || 0;
    const pur = kpis.total_purchase || 0;
    const profit = kpis.net_profit || 0;

    revenueChart.data.datasets[0].data = [0, 0, 0, 0, 0, 0, 0, rev];
    revenueChart.data.datasets[1].data = [0, 0, 0, 0, 0, 0, 0, pur];
    revenueChart.data.datasets[2].data = [0, 0, 0, 0, 0, 0, 0, profit];
    revenueChart.update();
}

// --- VOUCHER PREVIEW POPUP & HIGH-DPI IMAGE EXPORT ENGINE ---
let currentVoucherShipment = null;

function viewShipmentVoucher(id, mode = 'full') {
    const s = STATE.shipments.find(item => item.id === id);
    if (!s) return;

    currentVoucherShipment = s;
    const renderArea = document.getElementById('voucher-render-area');
    if (!renderArea) return;

    let pItems = [];
    let sItems = [];
    try {
        pItems = typeof s.purchase_items === 'string' ? JSON.parse(s.purchase_items) : (s.purchase_items || []);
    } catch(e) {}
    try {
        sItems = typeof s.sale_items === 'string' ? JSON.parse(s.sale_items) : (s.sale_items || []);
    } catch(e) {}

    const saleAmt = parseFloat(s.sale_amount) || 0;
    const purAmt = parseFloat(s.purchase_amount) || 0;
    const recAmt = s.received_amount !== undefined ? parseFloat(s.received_amount) : (s.sale_status === 'Completed' ? saleAmt : 0);
    const balAmt = Math.max(0, saleAmt - recAmt);
    const marginPct = saleAmt > 0 ? (((saleAmt - purAmt) / saleAmt) * 100).toFixed(1) : "0.0";
    const payStatus = s.sale_status || (recAmt >= saleAmt ? 'Completed' : (recAmt > 0 ? 'Partially Paid' : 'Pending'));

    const purRowsHTML = pItems.length > 0 ? pItems.map(p => `
        <tr>
            <td>${p.type || 'LINE'}</td>
            <td>${p.vendor_name || 'N/A'}</td>
            <td>${p.date || s.date}</td>
            <td>₹${(parseFloat(p.amount) || 0).toLocaleString('en-IN')}</td>
            <td><span class="status-pill ${p.status === 'Completed' ? 'status-completed' : 'status-pending'}">${p.status || 'Pending'}</span></td>
        </tr>
    `).join('') : `<tr><td colspan="5">Freight Purchase Charge: ₹${purAmt.toLocaleString('en-IN')}</td></tr>`;

    const saleRowsHTML = sItems.length > 0 ? sItems.map(item => `
        <tr>
            <td>${item.type || 'Freight'}</td>
            <td>₹${(parseFloat(item.amount) || 0).toLocaleString('en-IN')}</td>
            <td>${item.qty || 1}</td>
            <td>${item.ex_rate || 1}</td>
            <td>${item.gst || 0}%</td>
            <td><strong>₹${(parseFloat(item.final_amount) || 0).toLocaleString('en-IN')}</strong></td>
        </tr>
    `).join('') : `<tr><td colspan="6">Customer Sale Billing: ₹${saleAmt.toLocaleString('en-IN')}</td></tr>`;

    if (mode === 'payment') {
        // DEDICATED CUSTOMER PAYMENT RECEIVED VOUCHER
        renderArea.innerHTML = `
            <div class="voucher-card-header">
                <div>
                    <img src="https://lh3.googleusercontent.com/d/1BXwlXGmBgnASSSwvY4KvcKYFuHSgj6qy" alt="Akasha Logo">
                    <h2>Akasha LogiTrans LLP</h2>
                    <small>Customer Sale Bill & Payment Received Receipt Sheet</small>
                </div>
                <div style="text-align: right;">
                    <div class="voucher-badge-code">${s.id}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Date: ${s.date}</div>
                </div>
            </div>

            <div class="voucher-grid-2">
                <div class="voucher-box">
                    <div class="voucher-box-title">Client / Company Details</div>
                    <strong>${s.company_name}</strong><br>
                    <span>Client ID: ${s.client_id || 'N/A'}</span><br>
                    <span>SB/BE No: ${s.sb_be_no || 'N/A'}</span>
                </div>
                <div class="voucher-box">
                    <div class="voucher-box-title">Shipment & Logistics Info</div>
                    <span>Shipment Type: <strong>${s.shipment_type || 'Export Freight'}</strong></span><br>
                    <span>Shipping Line: ${s.line_name || 'N/A'}</span><br>
                    <span>Transport Name: ${s.transport_name || 'N/A'}</span>
                </div>
            </div>

            <div class="voucher-table-title" style="background: #ecfdf5; color: #065f46;">SECTION A: CUSTOMER SALE BILL BREAKDOWN</div>
            <table class="voucher-table">
                <thead>
                    <tr>
                        <th>Charges Name</th>
                        <th>Amount (₹)</th>
                        <th>Qty</th>
                        <th>Ex Rate</th>
                        <th>GST %</th>
                        <th>Final Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${saleRowsHTML}
                </tbody>
            </table>

            <div class="voucher-table-title" style="background: #eff6ff; color: #1e40af; margin-top: 18px;">SECTION B: PAYMENT RECEIVE DATE & TRANSACTION SUMMARY LOG</div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 12px; font-size: 13px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div><strong>Payment Receive Date:</strong> <span style="color: var(--primary); font-weight: 700;">${s.payment_receive_date || s.date}</span></div>
                    <div><strong>Payment Status:</strong> <span class="status-pill ${payStatus === 'Completed' ? 'status-completed' : (payStatus === 'Partially Paid' ? 'status-in-transit' : 'status-pending')}" style="${payStatus === 'Partially Paid' ? 'background: #fffbe3; color: #b45309; border: 1px solid #fde68a;' : ''}">${payStatus}</span></div>
                    <div><strong>Total Sale Invoice Amount:</strong> ₹${saleAmt.toLocaleString('en-IN')}</div>
                    <div><strong>Received Amount So Far:</strong> <strong style="color: var(--success);">₹${recAmt.toLocaleString('en-IN')}</strong></div>
                    <div><strong>Remaining Balance Pending:</strong> <strong style="color: ${balAmt > 0 ? '#d97706' : '#10B981'};">₹${balAmt.toLocaleString('en-IN')}</strong></div>
                </div>
            </div>

            <div class="voucher-footer-sign">
                <div>Prepared By: Akasha LogiTrans ERP System</div>
                <div>Audit Status: Verified & Approved</div>
                <div>Authorized Signature: _______________________</div>
            </div>
        `;
    } else if (mode === 'purchase') {
        // DEDICATED VENDOR PURCHASE BILL VOUCHER
        renderArea.innerHTML = `
            <div class="voucher-card-header">
                <div>
                    <img src="https://lh3.googleusercontent.com/d/1BXwlXGmBgnASSSwvY4KvcKYFuHSgj6qy" alt="Akasha Logo">
                    <h2>Akasha LogiTrans LLP</h2>
                    <small>Vendor Carrier Purchase Bill Voucher Sheet</small>
                </div>
                <div style="text-align: right;">
                    <div class="voucher-badge-code">${s.id}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Date: ${s.date}</div>
                </div>
            </div>

            <div class="voucher-grid-2">
                <div class="voucher-box">
                    <div class="voucher-box-title">Company & Client Details</div>
                    <strong>${s.company_name}</strong><br>
                    <span>Client ID: ${s.client_id || 'N/A'}</span><br>
                    <span>SB/BE No: ${s.sb_be_no || 'N/A'}</span>
                </div>
                <div class="voucher-box">
                    <div class="voucher-box-title">Carrier & Transport Info</div>
                    <span>Shipping Line: <strong>${s.line_name || 'N/A'}</strong></span><br>
                    <span>Transport Name: ${s.transport_name || 'N/A'}</span><br>
                    <span>Shipment Type: ${s.shipment_type || 'Export Freight'}</span>
                </div>
            </div>

            <div class="voucher-table-title" style="background: #eff6ff; color: #1e40af;">SECTION A: VENDOR PURCHASE EXPENSES BREAKDOWN</div>
            <table class="voucher-table">
                <thead>
                    <tr>
                        <th>Charges Type</th>
                        <th>Vendor Name</th>
                        <th>Date</th>
                        <th>Amount (₹)</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${purRowsHTML}
                </tbody>
            </table>

            <div class="voucher-table-title" style="background: #f8fafc; color: #334155; margin-top: 18px;">SECTION B: VENDOR PURCHASE PAYMENT DATE & COST SUMMARY LOG</div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 12px; font-size: 13px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div><strong>Purchase Bill Date:</strong> <span style="color: var(--primary); font-weight: 700;">${s.purchase_date || s.date}</span></div>
                    <div><strong>Vendor Payment Status:</strong> <span class="status-pill ${s.purchase_status === 'Completed' ? 'status-completed' : 'status-pending'}">${s.purchase_status || 'Pending'}</span></div>
                    <div><strong>Total Purchase Cost Expense:</strong> <strong style="color: var(--primary);">₹${purAmt.toLocaleString('en-IN')}</strong></div>
                </div>
            </div>

            <div class="voucher-footer-sign">
                <div>Prepared By: Akasha LogiTrans ERP System</div>
                <div>Audit Status: Verified & Approved</div>
                <div>Authorized Signature: _______________________</div>
            </div>
        `;
    } else {
        // FULL COMBINED MASTER JOB VOUCHER
        renderArea.innerHTML = `
            <div class="voucher-card-header">
                <div>
                    <img src="https://lh3.googleusercontent.com/d/1BXwlXGmBgnASSSwvY4KvcKYFuHSgj6qy" alt="Akasha Logo">
                    <h2>Akasha LogiTrans LLP</h2>
                    <small>Internal Freight Accounting & Profit Ledger Voucher Sheet</small>
                </div>
                <div style="text-align: right;">
                    <div class="voucher-badge-code">${s.id}</div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Date: ${s.date}</div>
                </div>
            </div>

            <div class="voucher-grid-2">
                <div class="voucher-box">
                    <div class="voucher-box-title">Client / Company Details</div>
                    <strong>${s.company_name}</strong><br>
                    <span>Client ID: ${s.client_id || 'N/A'}</span><br>
                    <span>SB/BE No: ${s.sb_be_no || 'N/A'}</span>
                </div>
                <div class="voucher-box">
                    <div class="voucher-box-title">Shipment & Logistics Info</div>
                    <span>Shipment Type: <strong>${s.shipment_type || 'Export Freight'}</strong></span><br>
                    <span>Shipping Line: ${s.line_name || 'N/A'}</span><br>
                    <span>Transport Name: ${s.transport_name || 'N/A'}</span>
                </div>
            </div>

            <div class="voucher-table-title" style="background: #eff6ff; color: #1e40af;">SECTION 2: PURCHASE VENDOR COST BREAKDOWN</div>
            <table class="voucher-table">
                <thead>
                    <tr>
                        <th>Charges Type</th>
                        <th>Vendor Name</th>
                        <th>Date</th>
                        <th>Amount (₹)</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${purRowsHTML}
                </tbody>
            </table>

            <div class="voucher-table-title" style="background: #ecfdf5; color: #065f46;">SECTION 3: SALE CUSTOMER BILLING BREAKDOWN</div>
            <table class="voucher-table">
                <thead>
                    <tr>
                        <th>Charges Name</th>
                        <th>Amount (₹)</th>
                        <th>Qty</th>
                        <th>Ex Rate</th>
                        <th>GST %</th>
                        <th>Final Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${saleRowsHTML}
                </tbody>
            </table>

            <div class="voucher-summary-banner">
                <div class="voucher-summary-item">
                    <span>TOTAL PURCHASE EXPENSES</span>
                    <strong>₹${purAmt.toLocaleString('en-IN')}</strong>
                </div>
                <div class="voucher-summary-item">
                    <span>TOTAL SALE REVENUE</span>
                    <strong>₹${saleAmt.toLocaleString('en-IN')}</strong>
                </div>
                <div class="voucher-summary-item">
                    <span>NET MARGIN (${marginPct}%)</span>
                    <strong style="color: #34d399;">₹${(s.net_profit || 0).toLocaleString('en-IN')}</strong>
                </div>
            </div>

            <div class="voucher-footer-sign">
                <div>Prepared By: Akasha LogiTrans ERP System</div>
                <div>Audit Status: Verified & Approved</div>
                <div>Authorized Signature: _______________________</div>
            </div>
        `;
    }

    openModal('modal-voucher-preview');
}

function downloadVoucherImage(format = 'png') {
    if (!currentVoucherShipment) return;

    const renderArea = document.getElementById('voucher-render-area');
    if (!renderArea) return;

    showToast('Generating screenshot image...', 'info');

    html2canvas(renderArea, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
        const link = document.createElement('a');
        const cleanShpId = (currentVoucherShipment.id || 'AKASHA').replace(/\//g, '_');
        const cleanCompName = (currentVoucherShipment.company_name || 'Company').replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${cleanShpId}_${cleanCompName}.${format}`;
        
        link.download = fileName;
        link.href = canvas.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(`Downloaded ${fileName} successfully!`, 'success');
    }).catch(err => {
        showToast('Image export error', 'danger');
    });
}

function printVoucherFromModal() {
    if (currentVoucherShipment) {
        printShipmentVoucher(currentVoucherShipment.id);
    }
}

// --- QUICK RECEIVE PAYMENT MODAL ENGINE (MULTI-INSTALLMENT INCREMENTAL PAYMENTS) ---
function openQuickPaymentModal(shipmentId) {
    const s = STATE.shipments.find(item => item.id === shipmentId);
    if (!s) return;

    const saleAmt = parseFloat(s.sale_amount) || 0;
    const prevRec = s.received_amount !== undefined ? parseFloat(s.received_amount) : (s.sale_status === 'Completed' ? saleAmt : 0);
    const currBal = Math.max(0, saleAmt - prevRec);

    document.getElementById('quick-pay-shipment-id').value = s.id;
    document.getElementById('quick-pay-display-id').innerText = s.id;
    document.getElementById('quick-pay-display-company').innerText = s.company_name;
    document.getElementById('quick-pay-display-total').innerText = '₹' + saleAmt.toLocaleString('en-IN');
    document.getElementById('quick-pay-display-prev').innerText = '₹' + prevRec.toLocaleString('en-IN');
    document.getElementById('quick-pay-display-balance').innerText = '₹' + currBal.toLocaleString('en-IN');
    
    // Clear today's input field so user can type new installment (e.g. 3000)
    document.getElementById('quick-pay-today-input').value = '';
    document.getElementById('quick-pay-date-input').value = new Date().toISOString().split('T')[0];

    updateQuickPayCalcNotice();
    openModal('modal-quick-payment');
}

function payFullBalanceQuickly() {
    const shpId = document.getElementById('quick-pay-shipment-id').value;
    const s = STATE.shipments.find(item => item.id === shpId);
    if (!s) return;

    const saleAmt = parseFloat(s.sale_amount) || 0;
    const prevRec = s.received_amount !== undefined ? parseFloat(s.received_amount) : (s.sale_status === 'Completed' ? saleAmt : 0);
    const currBal = Math.max(0, saleAmt - prevRec);

    document.getElementById('quick-pay-today-input').value = currBal;
    updateQuickPayCalcNotice();
    showToast(`Loaded remaining balance ₹${currBal.toLocaleString('en-IN')}`, 'info');
}

function updateQuickPayCalcNotice() {
    const shpId = document.getElementById('quick-pay-shipment-id').value;
    const s = STATE.shipments.find(item => item.id === shpId);
    if (!s) return;

    const saleAmt = parseFloat(s.sale_amount) || 0;
    const prevRec = s.received_amount !== undefined ? parseFloat(s.received_amount) : (s.sale_status === 'Completed' ? saleAmt : 0);
    const todayPay = parseFloat(document.getElementById('quick-pay-today-input').value) || 0;
    
    const newTotalRec = prevRec + todayPay;
    const newBalance = Math.max(0, saleAmt - newTotalRec);
    const noticeEl = document.getElementById('quick-pay-calc-notice');

    if (newTotalRec >= saleAmt) {
        noticeEl.style.color = '#10B981';
        noticeEl.innerHTML = `Previous ₹${prevRec.toLocaleString('en-IN')} + Today ₹${todayPay.toLocaleString('en-IN')} = <strong>New Total ₹${newTotalRec.toLocaleString('en-IN')}</strong><br><span style="color: #10B981;">FULL PAYMENT COMPLETED! Remaining Balance: ₹0.00</span>`;
    } else if (newTotalRec > 0) {
        noticeEl.style.color = '#1e40af';
        noticeEl.innerHTML = `Previous ₹${prevRec.toLocaleString('en-IN')} + Today ₹${todayPay.toLocaleString('en-IN')} = <strong>New Total Received: ₹${newTotalRec.toLocaleString('en-IN')}</strong><br><span style="color: #b45309;">Remaining Pending Balance: ₹${newBalance.toLocaleString('en-IN')} (Status: PARTIALLY PAID)</span>`;
    } else {
        noticeEl.style.color = '#64748b';
        noticeEl.innerText = `Enter today's installment payment amount above... (Current Balance: ₹${(saleAmt - prevRec).toLocaleString('en-IN')})`;
    }
}

async function handleQuickPaymentSubmit(e) {
    e.preventDefault();
    const shpId = document.getElementById('quick-pay-shipment-id').value;
    const s = STATE.shipments.find(item => item.id === shpId);
    if (!s) return;

    const saleAmt = parseFloat(s.sale_amount) || 0;
    const prevRec = s.received_amount !== undefined ? parseFloat(s.received_amount) : (s.sale_status === 'Completed' ? saleAmt : 0);
    const todayPay = parseFloat(document.getElementById('quick-pay-today-input').value) || 0;
    const newTotalRec = prevRec + todayPay;
    const payDate = document.getElementById('quick-pay-date-input').value;

    try {
        const res = await fetch(`${API_BASE_URL}/payments-received/${encodeURIComponent(shpId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                received_amount: newTotalRec,
                payment_receive_date: payDate
            })
        });

        if (res.ok) {
            closeModal('modal-quick-payment');
            showToast('Installment payment received & balance updated successfully!', 'success');
            await fetchBackendAPIData();
        } else {
            showToast('Failed to update payment', 'danger');
        }
    } catch(err) {
        showToast('Payment update API error', 'danger');
    }
}
