/* ==========================================================================
   AKASHA LOGITRANS LLP - FREIGHT FORWARDING ERP ENGINE (JS)
   Zero-Data-Loss Hybrid Persistence & Real-Time Sync
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
    loadLocalState();
    fetchBackendAPIData();
});

function loadLocalState() {
    const savedClients = localStorage.getItem('AKASHA_ERP_CLIENTS');
    const savedShipments = localStorage.getItem('AKASHA_ERP_SHIPMENTS');

    if (savedClients) {
        try {
            const parsed = JSON.parse(savedClients);
            if (Array.isArray(parsed) && parsed.length > 0) {
                STATE.clients = parsed;
            }
        } catch(e){}
    }

    if (savedShipments) {
        try {
            const parsed = JSON.parse(savedShipments);
            if (Array.isArray(parsed) && parsed.length > 0) {
                STATE.shipments = parsed;
                STATE.filteredShipments = [...parsed];
            }
        } catch(e){}
    }

    renderClientsTable();
    populateFullClientDropdown();
    renderShipmentsTable();
    renderPaymentReceivedTable(null);
    renderPurchaseEntryTable(null);
    renderProfitLedgerTable(null);
    recalculateKPIsFromState();
}

function recalculateKPIsFromState() {
    let rev = 0;
    let pur = 0;
    let pft = 0;
    let pend = 0;

    (STATE.shipments || []).forEach(s => {
        const sAmt = parseFloat(s.sale_amount) || 0;
        const pAmt = parseFloat(s.purchase_amount) || 0;
        const recAmt = s.received_amount !== undefined ? parseFloat(s.received_amount) : (s.sale_status === 'Completed' ? sAmt : 0);
        const balAmt = Math.max(0, sAmt - recAmt);

        rev += sAmt;
        pur += pAmt;
        pft += (sAmt - pAmt);
        pend += balAmt;
    });

    STATE.kpis = {
        monthly_revenue: rev,
        total_purchase: pur,
        net_profit: pft,
        pending_payment: pend
    };

    const revEl = document.getElementById('kpi-monthly-revenue');
    const purEl = document.getElementById('kpi-total-purchase');
    const pftEl = document.getElementById('kpi-net-profit');
    const pendEl = document.getElementById('kpi-pending-payment');

    if (revEl) revEl.innerText = '₹' + rev.toLocaleString('en-IN');
    if (purEl) purEl.innerText = '₹' + pur.toLocaleString('en-IN');
    if (pftEl) pftEl.innerText = '₹' + pft.toLocaleString('en-IN');
    if (pendEl) pendEl.innerText = '₹' + pend.toLocaleString('en-IN');

    updateChartData(STATE.kpis);
}

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
    const cleanPath = pathname.replace(/\/$/, '') || '/';
    
    if (cleanPath === '/client-master/new') {
        switchView('client-form');
        openFullAddClientPage();
        document.title = 'Add New Client | Akasha ERP';
        return;
    }
    if (cleanPath.startsWith('/client-master/edit/')) {
        const id = cleanPath.split('/client-master/edit/')[1];
        switchView('client-form');
        openFullEditClientPage(decodeURIComponent(id));
        document.title = `Edit Client ${id} | Akasha ERP`;
        return;
    }
    
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
    if (viewId === 'payment-received' || viewId === 'payment_received') renderPaymentReceivedTable(null);
    if (viewId === 'purchase-entry' || viewId === 'purchase_entry') renderPurchaseEntryTable(null);
    if (viewId === 'profit-ledger' || viewId === 'profit_ledger') renderProfitLedgerTable(null);
    if (viewId === 'clients') renderClientsTable();
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
        console.log("Local Database Ready.");
    }
}

async function fetchDashboardKPIs() {
    try {
        const res = await fetch(`${API_BASE_URL}/dashboard/kpis`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.monthly_revenue !== undefined) {
                STATE.kpis = data;
                document.getElementById('kpi-monthly-revenue').innerText = '₹' + (data.monthly_revenue || 0).toLocaleString('en-IN');
                document.getElementById('kpi-total-purchase').innerText = '₹' + (data.total_purchase || 0).toLocaleString('en-IN');
                document.getElementById('kpi-net-profit').innerText = '₹' + (data.net_profit || 0).toLocaleString('en-IN');
                document.getElementById('kpi-pending-payment').innerText = '₹' + (data.pending_payment || 0).toLocaleString('en-IN');
                updateChartData(data);
            }
        }
    } catch (e) {
        recalculateKPIsFromState();
    }
}

async function fetchClientsData() {
    try {
        const res = await fetch(`${API_BASE_URL}/clients`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                const merged = [...data];
                STATE.clients.forEach(localC => {
                    if (!merged.some(remoteC => remoteC.id === localC.id)) {
                        merged.push(localC);
                    }
                });
                STATE.clients = merged;
                localStorage.setItem('AKASHA_ERP_CLIENTS', JSON.stringify(STATE.clients));
                renderClientsTable();
                populateFullClientDropdown();
            }
        }
    } catch (e) {}
}

async function fetchShipmentsData() {
    try {
        const res = await fetch(`${API_BASE_URL}/shipments`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                const merged = [...data];
                STATE.shipments.forEach(localS => {
                    if (!merged.some(remoteS => remoteS.id === localS.id)) {
                        merged.push(localS);
                    }
                });
                STATE.shipments = merged;
                STATE.filteredShipments = [...merged];
                localStorage.setItem('AKASHA_ERP_SHIPMENTS', JSON.stringify(STATE.shipments));
                renderShipmentsTable();
                renderPaymentReceivedTable(null);
                renderPurchaseEntryTable(null);
                renderProfitLedgerTable(null);
                recalculateKPIsFromState();
            }
        }
    } catch (e) {}
}

async function fetchPaymentsReceivedData() {
    try {
        const res = await fetch(`${API_BASE_URL}/payments-received`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                STATE.payments = data;
                renderPaymentReceivedTable(data);
            }
        }
    } catch (e) {}
}

async function fetchPurchasesData() {
    try {
        const res = await fetch(`${API_BASE_URL}/purchases`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                STATE.purchases = data;
                renderPurchaseEntryTable(data);
            }
        }
    } catch (e) {}
}

async function fetchProfitLedgerData() {
    try {
        const res = await fetch(`${API_BASE_URL}/profit-ledger`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                STATE.profitLedger = data;
                renderProfitLedgerTable(data);
            }
        }
    } catch (e) {}
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
                <button class="btn-action" onclick="navigateRoute('/client-master/edit/${encodeURIComponent(c.id)}')" title="Edit Client"><i class="fa-solid fa-pen"></i></button>
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
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 30px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-ship" style="font-size: 24px; margin-bottom: 8px; display: block;"></i> No Shipments Found. Click + Add Shipment to create entry.</td></tr>`;
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
                    <button class="btn-action" onclick="navigateRoute('/shipment-entry/edit/${encodeURIComponent(s.id)}')" title="Edit Shipment"><i class="fa-solid fa-pen"></i></button>
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
                    <button class="btn-action" onclick="navigateRoute('/shipment-entry/edit/${encodeURIComponent(p.shipment_id)}')" title="Edit Entry"><i class="fa-solid fa-pen"></i></button>
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
                <button class="btn-action" onclick="navigateRoute('/shipment-entry/edit/${encodeURIComponent(p.shipment_id)}')" title="Edit Entry"><i class="fa-solid fa-pen"></i></button>
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
    
    let totalSale = 0;
    let totalCost = 0;
    let totalNetProfit = 0;

    if (list && list.length > 0) {
        list.forEach(item => {
            const sAmt = parseFloat(item.sale_amount) || 0;
            const pAmt = parseFloat(item.purchase_amount) || 0;
            const net = item.net_profit !== undefined ? parseFloat(item.net_profit) : (sAmt - pAmt);

            totalSale += sAmt;
            totalCost += pAmt;
            totalNetProfit += net;
        });
    }

    const avgMargin = totalSale > 0 ? ((totalNetProfit / totalSale) * 100).toFixed(1) : "0.0";

    const saleEl = document.getElementById('kpi-ledger-total-sale');
    const costEl = document.getElementById('kpi-ledger-total-cost');
    const profitEl = document.getElementById('kpi-ledger-net-profit');
    const marginEl = document.getElementById('kpi-ledger-avg-margin');

    if (saleEl) saleEl.innerText = '₹' + totalSale.toLocaleString('en-IN');
    if (costEl) costEl.innerText = '₹' + totalCost.toLocaleString('en-IN');
    if (profitEl) profitEl.innerText = '₹' + totalNetProfit.toLocaleString('en-IN');
    if (marginEl) marginEl.innerText = avgMargin + '%';

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-chart-line" style="font-size: 24px; margin-bottom: 8px; display: block;"></i> No Profit Ledger Entries Found. Click + Add Shipment to create entry.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => {
        const sAmt = parseFloat(item.sale_amount) || 0;
        const pAmt = parseFloat(item.purchase_amount) || 0;
        const netPft = item.net_profit !== undefined ? parseFloat(item.net_profit) : (sAmt - pAmt);
        const margin = item.gross_margin !== undefined ? item.gross_margin : (sAmt > 0 ? ((netPft / sAmt) * 100).toFixed(1) : "0.0");

        return `
            <tr>
                <td><strong>${item.shipment_id}</strong></td>
                <td><strong>${item.company_name}</strong> <small style="color: var(--text-muted);">(${item.client_id || 'N/A'})</small></td>
                <td>₹${pAmt.toLocaleString('en-IN')}</td>
                <td>₹${sAmt.toLocaleString('en-IN')}</td>
                <td><strong style="color: ${netPft >= 0 ? '#10B981' : '#EF4444'};">₹${netPft.toLocaleString('en-IN')}</strong></td>
                <td><span class="status-pill status-completed" style="background: #ecfdf5; color: #047857; font-weight: 800;">${margin}%</span></td>
                <td>
                    <button class="btn-action" onclick="viewShipmentVoucher('${item.shipment_id}')" title="View Profit Voucher" style="color: var(--primary);"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-action" onclick="navigateRoute('/shipment-entry/edit/${encodeURIComponent(item.shipment_id)}')" title="Edit Shipment Entry"><i class="fa-solid fa-pen"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- SEARCH & FILTER ENGINE ---
function handleShipmentSearch() {
    const query = (document.getElementById('shipments-search-input').value || '').toLowerCase().trim();
    if (!query) {
        STATE.filteredShipments = [...STATE.shipments];
    } else {
        STATE.filteredShipments = STATE.shipments.filter(s => 
            s.id.toLowerCase().includes(query) ||
            s.company_name.toLowerCase().includes(query) ||
            (s.sb_be_no && s.sb_be_no.toLowerCase().includes(query)) ||
            (s.client_id && s.client_id.toLowerCase().includes(query)) ||
            (s.line_name && s.line_name.toLowerCase().includes(query))
        );
    }
    STATE.currentPage = 1;
    renderShipmentsTable();
}

// --- FULL PAGE SHIPMENT ENTRY WORKSPACE CONTROLLER ---
function populateFullClientDropdown() {
    const select = document.getElementById('full-shp-client-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Select Client / Company --</option>' + 
        STATE.clients.map(c => `<option value="${c.id}">${c.name} (${c.id})</option>`).join('');

    select.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        const client = STATE.clients.find(c => c.id === selectedId);
        if (client) {
            document.getElementById('full-shp-company-name').value = client.name;
        }
    });
}

function addFullPurchaseRow(data = null) {
    const container = document.getElementById('full-purchase-rows-container');
    if (!container) return;

    const rowId = 'pur_row_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const box = document.createElement('div');
    box.className = 'purchase-row-box';
    box.id = rowId;
    
    const today = new Date().toISOString().split('T')[0];
    
    box.innerHTML = `
        <div class="grid-12" style="align-items: center; gap: 8px;">
            <div class="col-2 form-group" style="margin: 0;">
                <label style="font-size: 11px;">Cost Date</label>
                <input type="date" class="form-control light-input purchase-row-date" value="${data ? data.date : today}">
            </div>
            <div class="col-3 form-group" style="margin: 0;">
                <label style="font-size: 11px;">Charges Type *</label>
                <select class="form-control light-input purchase-row-type">
                    <option ${data && data.type === 'Ocean Freight' ? 'selected' : ''}>Ocean Freight</option>
                    <option ${data && data.type === 'Local Transport Cost' ? 'selected' : ''}>Local Transport Cost</option>
                    <option ${data && data.type === 'CFS / Terminal Charges' ? 'selected' : ''}>CFS / Terminal Charges</option>
                    <option ${data && data.type === 'Customs Clearance' ? 'selected' : ''}>Customs Clearance</option>
                    <option ${data && data.type === 'CHA Documentation' ? 'selected' : ''}>CHA Documentation</option>
                    <option ${data && data.type === 'BL Release Fee' ? 'selected' : ''}>BL Release Fee</option>
                </select>
            </div>
            <div class="col-3 form-group" style="margin: 0;">
                <label style="font-size: 11px;">Vendor Name</label>
                <input type="text" class="form-control light-input purchase-row-vendor" placeholder="e.g. Maersk / CHA Vendor" value="${data ? (data.vendor_name || '') : ''}">
            </div>
            <div class="col-2 form-group" style="margin: 0;">
                <label style="font-size: 11px;">Purchase Amt (₹) *</label>
                <input type="number" class="form-control light-input purchase-row-amount" placeholder="0.00" value="${data ? data.amount : ''}" oninput="calcFullShipmentTotals()">
            </div>
            <div class="col-2 form-group" style="margin: 0;">
                <label style="font-size: 11px;">Payment Status</label>
                <div style="display: flex; gap: 4px;">
                    <select class="form-control light-input purchase-row-status">
                        <option value="Completed" ${data && data.status === 'Completed' ? 'selected' : ''}>Paid (Completed)</option>
                        <option value="Pending" ${data && data.status === 'Pending' ? 'selected' : ''}>Unpaid (Pending)</option>
                    </select>
                    <button type="button" class="btn-action" style="color: var(--danger); padding: 4px 8px;" onclick="document.getElementById('${rowId}').remove(); calcFullShipmentTotals();"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>
    `;
    container.appendChild(box);
    calcFullShipmentTotals();
}

function addFullSaleRow(data = null) {
    const container = document.getElementById('full-sale-rows-container');
    if (!container) return;

    const rowId = 'sale_row_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const box = document.createElement('div');
    box.className = 'sale-row-box';
    box.id = rowId;

    box.innerHTML = `
        <div class="grid-12" style="align-items: center; gap: 8px;">
            <div class="col-3 form-group" style="margin: 0;">
                <label style="font-size: 11px;">Sale Item Name *</label>
                <select class="form-control light-input sale-row-type">
                    <option ${data && data.type === 'Freight Sale Revenue' ? 'selected' : ''}>Freight Sale Revenue</option>
                    <option ${data && data.type === 'THC / Terminal Handling' ? 'selected' : ''}>THC / Terminal Handling</option>
                    <option ${data && data.type === 'Customs Clearance Billing' ? 'selected' : ''}>Customs Clearance Billing</option>
                    <option ${data && data.type === 'Transportation Billing' ? 'selected' : ''}>Transportation Billing</option>
                    <option ${data && data.type === 'BL Charges Invoiced' ? 'selected' : ''}>BL Charges Invoiced</option>
                </select>
            </div>
            <div class="col-2 form-group" style="margin: 0;">
                <label style="font-size: 11px;">Rate (₹ / $)</label>
                <input type="number" class="form-control light-input sale-row-amount" placeholder="0.00" value="${data ? data.amount : ''}" oninput="calcFullShipmentTotals()">
            </div>
            <div class="col-2 form-group" style="margin: 0;">
                <label style="font-size: 11px;">Qty / Units</label>
                <input type="number" class="form-control light-input sale-row-qty" value="${data ? (data.qty || 1) : 1}" oninput="calcFullShipmentTotals()">
            </div>
            <div class="col-2 form-group" style="margin: 0;">
                <label style="font-size: 11px;">Ex Rate (₹)</label>
                <input type="number" class="form-control light-input sale-row-exrate" value="${data ? (data.ex_rate || 1) : 1}" oninput="calcFullShipmentTotals()">
            </div>
            <div class="col-2 form-group" style="margin: 0;">
                <label style="font-size: 11px;">GST %</label>
                <select class="form-control light-input sale-row-gst" onchange="calcFullShipmentTotals()">
                    <option value="0" ${data && data.gst == '0' ? 'selected' : ''}>0% (Export/Nil)</option>
                    <option value="18" ${data && data.gst == '18' ? 'selected' : ''}>18% GST</option>
                    <option value="5" ${data && data.gst == '5' ? 'selected' : ''}>5% GST</option>
                </select>
            </div>
            <div class="col-1 form-group" style="margin: 0; text-align: right;">
                <button type="button" class="btn-action" style="color: var(--danger); padding: 4px 8px; margin-top: 14px;" onclick="document.getElementById('${rowId}').remove(); calcFullShipmentTotals();"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `;
    container.appendChild(box);
    calcFullShipmentTotals();
}

function calcFullShipmentTotals() {
    let totPurchase = 0;
    document.querySelectorAll('#full-purchase-rows-container .purchase-row-amount').forEach(inp => {
        totPurchase += parseFloat(inp.value) || 0;
    });

    let totSale = 0;
    document.querySelectorAll('#full-sale-rows-container .sale-row-box').forEach(box => {
        const amt = parseFloat(box.querySelector('.sale-row-amount').value) || 0;
        const qty = parseFloat(box.querySelector('.sale-row-qty').value) || 1;
        const exRate = parseFloat(box.querySelector('.sale-row-exrate').value) || 1;
        const gst = parseFloat(box.querySelector('.sale-row-gst').value) || 0;
        const sub = amt * qty * exRate;
        const finalAmt = sub + (sub * (gst / 100));
        totSale += finalAmt;
    });

    const netProfit = totSale - totPurchase;
    const marginPct = totSale > 0 ? ((netProfit / totSale) * 100).toFixed(1) : "0.0";

    const pEl = document.getElementById('calc-total-purchase');
    const sEl = document.getElementById('calc-total-sale');
    const nEl = document.getElementById('calc-net-profit');
    const mEl = document.getElementById('calc-margin-pct');

    if (pEl) pEl.innerText = '₹' + totPurchase.toLocaleString('en-IN');
    if (sEl) sEl.innerText = '₹' + totSale.toLocaleString('en-IN');
    if (nEl) {
        nEl.innerText = '₹' + netProfit.toLocaleString('en-IN');
        nEl.style.color = netProfit >= 0 ? '#10B981' : '#EF4444';
    }
    if (mEl) mEl.innerText = marginPct + '%';
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

    const compName = document.getElementById('full-shp-company-name').value.trim();
    if (!compName) {
        Swal.fire({ icon: 'warning', title: 'Missing Information', text: 'Please enter or select Company Name' });
        return;
    }

    const rawId = document.getElementById('full-shp-id').value.trim();
    const nextCount = String(STATE.shipments.length + 1).padStart(3, '0');
    const cleanClientId = document.getElementById('full-shp-client-select').value || 'JOB';
    const defaultShpId = `AKASHA/${cleanClientId.toUpperCase()}/${nextCount}`;
    const shpId = editId || (rawId && rawId !== 'AUTO' ? rawId : defaultShpId);

    const shpObj = {
        id: shpId,
        client_id: document.getElementById('full-shp-client-select').value,
        company_name: compName,
        line_name: document.getElementById('full-shp-line-name').value.trim(),
        transport_name: document.getElementById('full-shp-transport-name').value.trim(),
        date: document.getElementById('full-shp-date').value || new Date().toISOString().split('T')[0],
        sb_be_no: document.getElementById('full-shp-sb-be-no').value.trim(),
        shipment_type: document.getElementById('full-shp-type').value || 'Export Freight',
        purchase_date: document.getElementById('full-shp-date').value,
        purchase_amount: totPurchase,
        purchase_status: purStatus,
        purchase_items: purchaseItems,
        payment_receive_date: document.getElementById('full-shp-date').value,
        sale_amount: totSale,
        received_amount: saleStatus === 'Completed' ? totSale : 0,
        sale_status: saleStatus,
        sale_items: saleItems,
        net_profit: totSale - totPurchase
    };

    // 1. Immediately update local STATE & localStorage backup so ALL 5 tables update INSTANTLY!
    if (editId) {
        const idx = STATE.shipments.findIndex(item => item.id === editId);
        if (idx !== -1) STATE.shipments[idx] = shpObj;
    } else {
        const existingIdx = STATE.shipments.findIndex(item => item.id === shpObj.id);
        if (existingIdx !== -1) {
            STATE.shipments[existingIdx] = shpObj;
        } else {
            STATE.shipments.unshift(shpObj);
        }
    }

    STATE.filteredShipments = [...STATE.shipments];
    localStorage.setItem('AKASHA_ERP_SHIPMENTS', JSON.stringify(STATE.shipments));

    renderShipmentsTable();
    renderPaymentReceivedTable(null);
    renderPurchaseEntryTable(null);
    renderProfitLedgerTable(null);
    recalculateKPIsFromState();

    Swal.fire({ icon: 'success', title: 'Shipment Saved!', text: `Shipment Voucher ${shpObj.id} saved into ERP!` });

    // 2. Sync to Backend Database API silently
    try {
        if (editId) {
            await fetch(`${API_BASE_URL}/shipments/${encodeURIComponent(editId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shpObj)
            });
        } else {
            await fetch(`${API_BASE_URL}/shipments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shpObj)
            });
        }
    } catch (e) {}

    navigateRoute('/shipment-entry');
}

async function deleteShipment(id) {
    const result = await Swal.fire({
        title: `Delete Shipment ${id}?`,
        text: "This shipment entry will be permanently removed!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, Delete Entry'
    });

    if (result.isConfirmed) {
        STATE.shipments = STATE.shipments.filter(s => s.id !== id);
        STATE.filteredShipments = STATE.filteredShipments.filter(s => s.id !== id);
        localStorage.setItem('AKASHA_ERP_SHIPMENTS', JSON.stringify(STATE.shipments));
        
        renderShipmentsTable();
        renderPaymentReceivedTable(null);
        renderPurchaseEntryTable(null);
        renderProfitLedgerTable(null);
        recalculateKPIsFromState();

        try {
            await fetch(`${API_BASE_URL}/shipments/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (e) {}

        Swal.fire('Deleted!', `Shipment ${id} has been deleted.`, 'success');
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
    const nameVal = document.getElementById('full-client-name').value.trim();
    const ownerVal = document.getElementById('full-client-owner').value.trim();
    
    if (!nameVal) {
        Swal.fire({ icon: 'warning', title: 'Missing Field', text: 'Please enter Company Name' });
        return;
    }
    if (!ownerVal) {
        Swal.fire({ icon: 'warning', title: 'Missing Field', text: 'Please enter Owner Name' });
        return;
    }

    const clientObj = {
        id: editId || clientId || ('CLI-' + (STATE.clients.length + 101)),
        name: nameVal,
        owner: ownerVal
    };

    // 1. Immediately update local state & localStorage backup so UI NEVER loses data!
    if (editId) {
        const idx = STATE.clients.findIndex(c => c.id === editId);
        if (idx !== -1) STATE.clients[idx] = clientObj;
    } else {
        const existingIdx = STATE.clients.findIndex(c => c.id === clientObj.id);
        if (existingIdx !== -1) {
            STATE.clients[existingIdx] = clientObj;
        } else {
            STATE.clients.unshift(clientObj);
        }
    }
    localStorage.setItem('AKASHA_ERP_CLIENTS', JSON.stringify(STATE.clients));
    renderClientsTable();
    populateFullClientDropdown();
    Swal.fire({ icon: 'success', title: 'Saved!', text: `Client ${clientObj.name} (${clientObj.id}) saved to Directory!` });

    // 2. Sync to Backend Database API silently
    try {
        if (editId) {
            await fetch(`${API_BASE_URL}/clients/${encodeURIComponent(editId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clientObj)
            });
        } else {
            await fetch(`${API_BASE_URL}/clients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clientObj)
            });
        }
    } catch (e) {}
    
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
        STATE.clients = STATE.clients.filter(c => c.id !== id);
        localStorage.setItem('AKASHA_ERP_CLIENTS', JSON.stringify(STATE.clients));
        renderClientsTable();
        populateFullClientDropdown();

        try {
            await fetch(`${API_BASE_URL}/clients/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (e) {}
        Swal.fire('Deleted!', `Client ${id} has been deleted.`, 'success');
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
    const pft = kpis.net_profit || 0;

    revenueChart.data.datasets[0].data = [0, 0, 0, 0, 0, 0, 0, rev];
    revenueChart.data.datasets[1].data = [0, 0, 0, 0, 0, 0, 0, pur];
    revenueChart.data.datasets[2].data = [0, 0, 0, 0, 0, 0, 0, pft];
    revenueChart.update();
}

// --- SCREENSHOT VOUCHER ENGINE ---
let currentVoucherShipment = null;

function viewShipmentVoucher(id, mode = 'general') {
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

    const purAmt = parseFloat(s.purchase_amount) || 0;
    const saleAmt = parseFloat(s.sale_amount) || 0;
    const marginPct = saleAmt > 0 ? (((s.net_profit || (saleAmt - purAmt)) / saleAmt) * 100).toFixed(1) : "0.0";

    let purRowsHTML = pItems.map(item => `
        <tr>
            <td>${item.type || 'Vendor Purchase Expense'}</td>
            <td><strong>${item.vendor_name || 'N/A'}</strong></td>
            <td>${item.date || s.date}</td>
            <td>₹${(parseFloat(item.amount) || 0).toLocaleString('en-IN')}</td>
            <td><span class="status-pill ${item.status === 'Completed' ? 'status-completed' : 'status-pending'}">${item.status || 'Pending'}</span></td>
        </tr>
    `).join('');

    if (pItems.length === 0) {
        purRowsHTML = `
            <tr>
                <td>Freight & Logistics Handling Charges</td>
                <td>Standard Carrier Vendor</td>
                <td>${s.date}</td>
                <td>₹${purAmt.toLocaleString('en-IN')}</td>
                <td><span class="status-pill ${s.purchase_status === 'Completed' ? 'status-completed' : 'status-pending'}">${s.purchase_status || 'Pending'}</span></td>
            </tr>
        `;
    }

    let saleRowsHTML = sItems.map(item => `
        <tr>
            <td>${item.type || 'Freight Billing Charge'}</td>
            <td>₹${(parseFloat(item.amount) || 0).toLocaleString('en-IN')}</td>
            <td>${item.qty || 1}</td>
            <td>₹${item.ex_rate || 1}</td>
            <td>${item.gst || 0}%</td>
            <td><strong>₹${(parseFloat(item.final_amount || item.amount) || 0).toLocaleString('en-IN')}</strong></td>
        </tr>
    `).join('');

    if (sItems.length === 0) {
        saleRowsHTML = `
            <tr>
                <td>Export/Import Freight Customer Invoice</td>
                <td>₹${saleAmt.toLocaleString('en-IN')}</td>
                <td>1</td>
                <td>1.0</td>
                <td>0%</td>
                <td><strong>₹${saleAmt.toLocaleString('en-IN')}</strong></td>
            </tr>
        `;
    }

    renderArea.innerHTML = `
        <div class="voucher-header">
            <div class="voucher-logo">
                <img src="https://akashalogitrans.com/logo.png" alt="Akasha Logo" onerror="this.src='https://via.placeholder.com/160x50?text=AKASHA+LOGITRANS'">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-top: 4px;">AKASHA LOGITRANS LLP</div>
            </div>
            <div class="voucher-title-box">
                <h2>JOB PROFIT & COST VOUCHER</h2>
                <div style="font-weight: 800; font-size: 14px; color: #D71920;">JOB REF: ${s.id}</div>
                <small>Generated Date: ${new Date().toLocaleDateString('en-IN')}</small>
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

// --- QUICK RECEIVE PAYMENT MODAL ENGINE ---
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

    if (!noticeEl) return;

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
    if (e) e.preventDefault();
    const shpId = document.getElementById('quick-pay-shipment-id').value;
    const s = STATE.shipments.find(item => item.id === shpId);
    if (!s) return;

    const saleAmt = parseFloat(s.sale_amount) || 0;
    const prevRec = s.received_amount !== undefined ? parseFloat(s.received_amount) : (s.sale_status === 'Completed' ? saleAmt : 0);
    const todayPay = parseFloat(document.getElementById('quick-pay-today-input').value) || 0;
    const newTotalRec = prevRec + todayPay;
    const payDate = document.getElementById('quick-pay-date-input').value || new Date().toISOString().split('T')[0];
    const newStatus = newTotalRec >= saleAmt ? 'Completed' : (newTotalRec > 0 ? 'Partially Paid' : 'Pending');

    s.received_amount = newTotalRec;
    s.payment_receive_date = payDate;
    s.sale_status = newStatus;

    localStorage.setItem('AKASHA_ERP_SHIPMENTS', JSON.stringify(STATE.shipments));

    renderShipmentsTable();
    renderPaymentReceivedTable(null);
    renderPurchaseEntryTable(null);
    renderProfitLedgerTable(null);
    recalculateKPIsFromState();

    closeModal('modal-quick-payment');
    showToast(`Installment payment ₹${todayPay.toLocaleString('en-IN')} received for ${shpId}!`, 'success');

    try {
        await fetch(`${API_BASE_URL}/payments-received/${encodeURIComponent(shpId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                received_amount: newTotalRec,
                payment_receive_date: payDate
            })
        });
    } catch(err) {
        console.log("Payment update API error");
    }
}
