// ─────────────────────────────────────────────────────────
//  AI Agent API Marketplace - Client-Side App Logic
//  Designed for serverless and static deploys (e.g. Cloudflare Pages)
// ─────────────────────────────────────────────────────────

// Seed Default Users Database in LocalStorage
function seedDatabase() {
    if (!localStorage.getItem('agent_users_db')) {
        const DEFAULT_USERS = [
            {
                id: "admin_user_id",
                email: "admin@agentapis.com",
                password: "admin1234",
                apiKey: "agent_key_admin1234",
                balance: 1000.0,
                isAdmin: 1,
                purchasedApis: []
            },
            {
                id: "demo_user_id",
                email: "developer@gmail.com",
                password: "password123",
                apiKey: "agent_key_demo54321",
                balance: 100.0,
                isAdmin: 0,
                purchasedApis: []
            }
        ];
        localStorage.setItem('agent_users_db', JSON.stringify(DEFAULT_USERS));
    }
    
    // Seed default Easypaisa Number
    if (!localStorage.getItem('agent_ep_number')) {
        localStorage.setItem('agent_ep_number', '03001234567');
        localStorage.setItem('agent_ep_name', 'Muhammad Khalid');
    }
}

// App State
const state = {
    user: null,
    apis: [],
    categories: [],
    currentView: 'home',
    currentDashboardPane: 'keys',
    currentAdminPane: 'sa-overview',
    selectedSandboxApi: null,
    sandboxLanguage: 'curl',
    searchQuery: '',
    selectedCategory: 'All',
    selectedTiers: ['Free', 'Standard', 'Pro'],
    selectedAuths: ['No', 'apiKey', 'OAuth'],
    sortBy: 'name-asc',
    purchaseTargetApi: null
};

// Initialize session and databases on load
async function initSession() {
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/apis');
        if (res.ok) {
            state.apis = await res.json();
        } else {
            state.apis = APIS_DATA;
        }
    } catch (e) {
        console.error('Failed to load APIs from backend, falling back to static', e);
        state.apis = APIS_DATA;
    }
    
    updatePlatformStats();

    // Check for saved user session
    const savedUser = localStorage.getItem('agent_user');
    if (savedUser) {
        state.user = JSON.parse(savedUser);
        updateUserUI();
    } else {
        showView('home');
    }
}

// Router
function showView(viewId) {
    state.currentView = viewId;
    
    // Hide all pages, show target
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`${viewId}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Update navbar active states
    document.querySelectorAll('nav a').forEach(a => {
        if (a.getAttribute('onclick') && a.getAttribute('onclick').includes(viewId)) {
            a.classList.add('active');
        } else {
            a.classList.remove('active');
        }
    });

    // Page-specific initializers
    if (viewId === 'explore') {
        initExplorePage();
    } else if (viewId === 'portal') {
        if (!state.user) {
            showView('auth');
        } else {
            loadPortalData();
        }
    } else if (viewId === 'superadmin') {
        if (!state.user || !state.user.isAdmin) {
            showNotification('Access Denied', 'Super Admin privileges required.', 'error');
            showView('superadmin-login');
        } else {
            loadSuperAdminData();
        }
    } else if (viewId === 'admin') {
        // Redirect legacy admin tab to portal keys pane or super admin
        if (state.user && state.user.isAdmin) {
            showView('superadmin');
        } else {
            showView('portal');
        }
    }

    // Scroll to top
    window.scrollTo(0, 0);
}

// Sub-navigation in Developer Portal
function showDashboardPane(paneId) {
    state.currentDashboardPane = paneId;
    document.querySelectorAll('.dashboard-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu-btn').forEach(b => b.classList.remove('active'));
    
    const targetPane = document.getElementById(`${paneId}-pane`);
    if (targetPane) {
        targetPane.classList.add('active');
    }
    event.currentTarget.classList.add('active');

    if (paneId === 'sandbox') {
        initSandbox();
    } else if (paneId === 'subscriptions') {
        renderSubscribedApis();
    } else if (paneId === 'transactions') {
        renderUserLogs();
    } else if (paneId === 'submit-api') {
        initSubmitApiPane();
    }
}

// Sub-navigation in Super Admin
function showAdminPane(paneId) {
    state.currentAdminPane = paneId;
    document.querySelectorAll('.admin-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    
    const targetPane = document.getElementById(`${paneId}-pane`);
    if (targetPane) {
        targetPane.classList.add('active');
    }
    event.currentTarget.classList.add('active');

    if (paneId === 'sa-overview') {
        renderSuperAdminOverview();
    } else if (paneId === 'sa-payments') {
        renderPaymentQueue();
    } else if (paneId === 'sa-submitted-apis') {
        renderSubmittedApisReview();
    } else if (paneId === 'sa-agents') {
        renderAgentTable();
    } else if (paneId === 'sa-transactions') {
        renderAdminTransactions();
    } else if (paneId === 'sa-catalog') {
        renderCatalogTable();
    } else if (paneId === 'sa-settings') {
        renderAdminSettings();
    }
}

// Theme Toggle
function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    
    const themeBtn = document.querySelector('.theme-toggle');
    if (newTheme === 'dark') {
        themeBtn.innerHTML = '☀️';
    } else {
        themeBtn.innerHTML = '🌙';
    }
}

// Platform-Wide Counters Simulation
function updatePlatformStats() {
    const totalApisSpan = document.getElementById('stats-total-apis');
    if (totalApisSpan) totalApisSpan.textContent = state.apis.length;

    const logs = JSON.parse(localStorage.getItem('agent_system_logs') || '[]');
    const totalCallsSpan = document.getElementById('stats-total-calls');
    if (totalCallsSpan) totalCallsSpan.textContent = 12492 + logs.length;

    const users = JSON.parse(localStorage.getItem('agent_users_db') || '[]');
    const activeDevsSpan = document.getElementById('stats-active-developers');
    if (activeDevsSpan) activeDevsSpan.textContent = 84 + users.length;
}

// ─────────────────────────────────────────────────────────
//  Explore API Catalog View
// ─────────────────────────────────────────────────────────
function initExplorePage() {
    // Generate categories counts dynamically
    const catCounts = { 'All': state.apis.length };
    state.apis.forEach(api => {
        catCounts[api.category] = (catCounts[api.category] || 0) + 1;
    });
    
    state.categories = ['All', ...Object.keys(catCounts).filter(c => c !== 'All').sort()];
    
    // Render Category list in sidebar
    const catSidebar = document.getElementById('category-sidebar-list');
    if (catSidebar) {
        catSidebar.innerHTML = '';
        state.categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = `category-item ${state.selectedCategory === cat ? 'active' : ''}`;
            item.innerHTML = `
                <span>${cat}</span>
                <span class="category-badge">${catCounts[cat] || 0}</span>
            `;
            item.onclick = () => selectCategoryFilter(cat);
            catSidebar.appendChild(item);
        });
    }

    filterAndRenderApis();
}

function selectCategoryFilter(category) {
    state.selectedCategory = category;
    document.querySelectorAll('.category-item').forEach(el => {
        if (el.querySelector('span').textContent === category) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
    filterAndRenderApis();
}

function filterAndRenderApis() {
    // Capture checkboxes states
    state.selectedTiers = Array.from(document.querySelectorAll('.tier-checkbox:checked')).map(cb => cb.value);
    state.selectedAuths = Array.from(document.querySelectorAll('.auth-checkbox:checked')).map(cb => cb.value);
    state.searchQuery = document.getElementById('api-search').value.trim();

    let filtered = state.apis.filter(api => {
        // Search filter
        const matchesSearch = api.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                             api.description.toLowerCase().includes(state.searchQuery.toLowerCase());
        
        // Category filter
        const matchesCategory = state.selectedCategory === 'All' || api.category === state.selectedCategory;
        
        // Tier filter
        const matchesTier = state.selectedTiers.includes(api.tier);
        
        // Auth filter (Group check: apiKey matchesapiKey/apiKey, OAuth matches OAuth/OAuth, No matches No/none)
        let matchesAuth = false;
        const authType = api.auth.toLowerCase();
        
        state.selectedAuths.forEach(selAuth => {
            if (selAuth === 'No' && (authType === 'no' || authType === 'none' || authType === '')) {
                matchesAuth = true;
            } else if (selAuth === 'apiKey' && (authType.includes('apikey') || authType.includes('api key'))) {
                matchesAuth = true;
            } else if (selAuth === 'OAuth' && authType.includes('oauth')) {
                matchesAuth = true;
            }
        });
        
        return matchesSearch && matchesCategory && matchesTier && matchesAuth;
    });

    // Apply Sorting
    filtered.sort((a, b) => {
        if (state.sortBy === 'name-asc') {
            return a.name.localeCompare(b.name);
        } else if (state.sortBy === 'name-desc') {
            return b.name.localeCompare(a.name);
        } else if (state.sortBy === 'price-asc') {
            return a.price_per_call - b.price_per_call;
        } else if (state.sortBy === 'price-desc') {
            return b.price_per_call - a.price_per_call;
        }
        return 0;
    });

    // Update result count
    document.getElementById('results-count').textContent = `Showing ${filtered.length} APIs`;

    // Render Grid
    const container = document.getElementById('apis-grid');
    if (!container) return;
    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
            <h3>No APIs found matching selection.</h3>
            <p style="margin-top:0.5rem; font-size:0.9rem;">Adjust search filters or check category counts.</p>
        </div>`;
        return;
    }

    filtered.forEach(api => {
        const isBought = isApiSubscribed(api.name);
        let actionBtn = '';
        
        if (api.tier === 'Free') {
            actionBtn = `<button class="btn btn-primary btn-sm" onclick="tryApiSandbox('${api.name}')">Playground</button>`;
        } else if (isBought) {
            actionBtn = `<span class="badge badge-success" style="padding:0.45rem 0.75rem; border-radius:var(--radius-sm);">Unlocked ✓</span>
                         <button class="btn btn-secondary btn-sm" style="border: 1px solid var(--color-primary);" onclick="tryApiSandbox('${api.name}')">Run</button>`;
        } else {
            actionBtn = `<button class="btn btn-secondary btn-sm" onclick="openPurchaseModal('${api.name}')">Buy Access</button>`;
        }

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-category">${api.category}</div>
            <div class="card-title">
                ${api.name}
                <span class="badge ${api.is_active ? 'badge-success' : 'badge-danger'}">${api.is_active ? 'Active' : 'Offline'}</span>
            </div>
            <div class="card-desc" title="${api.description}">${api.description}</div>
            <div class="card-footer">
                <div class="api-price">${api.price_per_call.toFixed(2)} PKR <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">/ call</span></div>
                <div style="display:flex; gap:0.35rem; align-items:center;">
                    ${actionBtn}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function handleSortChange(val) {
    state.sortBy = val;
    filterAndRenderApis();
}

function handleSearchInput(val) {
    filterAndRenderApis();
}

// ─────────────────────────────────────────────────────────
//  API Purchase Flow (In-Memory/LocalStorage Wallet)
// ─────────────────────────────────────────────────────────
function isApiSubscribed(apiName) {
    if (!state.user) return false;
    // Admin gets free access to all APIs for evaluation
    if (state.user.isAdmin) return true;
    return state.user.purchasedApis && state.user.purchasedApis.includes(apiName);
}

function openPurchaseModal(apiName) {
    if (!state.user) {
        showNotification('Login Required', 'Please log in to purchase API keys.', 'error');
        showView('auth');
        return;
    }

    const api = state.apis.find(a => a.name === apiName);
    if (!api) return;

    state.purchaseTargetApi = api;
    
    // Flat subscription rates: Standard = 10 PKR, Pro = 50 PKR
    const unlockCost = api.tier === 'Standard' ? 10.00 : 50.00;
    
    document.getElementById('purchase-title').innerHTML = `Unlock API: <span style="color:var(--color-primary);">${api.name}</span>`;
    document.getElementById('purchase-details').innerHTML = `
        <p><strong>Tier:</strong> ${api.tier}</p>
        <p><strong>Description:</strong> ${api.description}</p>
        <p style="margin-top:0.5rem;">Unlocking allows your LLM agents to make pay-as-you-go proxy requests at <strong>${api.price_per_call.toFixed(2)} PKR per call</strong>.</p>
    `;
    
    document.getElementById('purchase-current-balance').textContent = `${state.user.balance.toFixed(2)} PKR`;
    document.getElementById('purchase-cost').textContent = `${unlockCost.toFixed(2)} PKR`;
    
    const rem = state.user.balance - unlockCost;
    const remSpan = document.getElementById('purchase-remaining-balance');
    remSpan.textContent = `${rem.toFixed(2)} PKR`;
    
    if (rem < 0) {
        remSpan.style.color = 'var(--color-danger)';
        document.getElementById('purchase-confirm-btn').disabled = true;
        document.getElementById('purchase-confirm-btn').textContent = 'Insufficient Wallet Credits';
    } else {
        remSpan.style.color = 'var(--color-success)';
        document.getElementById('purchase-confirm-btn').disabled = false;
        document.getElementById('purchase-confirm-btn').textContent = 'Confirm Purchase & Unlock';
        document.getElementById('purchase-confirm-btn').onclick = executeApiPurchase;
    }

    document.getElementById('purchase-modal').style.display = 'flex';
}

function closePurchaseModal() {
    document.getElementById('purchase-modal').style.display = 'none';
}

async function executeApiPurchase() {
    if (!state.user || !state.purchaseTargetApi) return;
    
    const api = state.purchaseTargetApi;
    
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: state.user.id, apiName: api.name })
        });
        const data = await res.json();
        if (!res.ok) {
            showNotification('Purchase Failed', data.error || 'Failed to complete purchase', 'error');
            return;
        }
        
        state.user.balance = data.balance;
        if (!state.user.purchasedApis) state.user.purchasedApis = [];
        state.user.purchasedApis.push(api.name);
        localStorage.setItem('agent_user', JSON.stringify(state.user));
        
        closePurchaseModal();
        updateUserUI();
        showNotification('Purchase Successful', `${api.name} is now unlocked!`, 'success');
        filterAndRenderApis();
    } catch (e) {
        showNotification('Connection Error', 'Backend purchase server unreachable', 'error');
    }
}

// ─────────────────────────────────────────────────────────
//  Developer Login / Registration
// ─────────────────────────────────────────────────────────
async function handleAuth(type) {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    
    if (!email || !password) {
        showNotification('Validation Error', 'Please enter email and password.', 'error');
        return;
    }
    
    const endpoint = type === 'register' ? '/api/auth/register' : '/api/auth/login';
    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) {
            showNotification('Auth Error', data.error || 'Authentication failed', 'error');
            return;
        }
        
        state.user = data.user;
        localStorage.setItem('agent_user', JSON.stringify(data.user));
        
        showNotification('Welcome!', type === 'register' ? 'Registration successful.' : `Welcome back, ${data.user.email}!`, 'success');
        updateUserUI();
        showView('portal');
    } catch (e) {
        showNotification('Connection Error', 'Failed to reach auth backend API', 'error');
    }
}

function logout() {
    state.user = null;
    localStorage.removeItem('agent_user');
    updateUserUI();
    showNotification('Logged Out', 'Successfully signed out.', 'info');
    showView('home');
}

function updateUserUI() {
    const authLink = document.getElementById('nav-auth-link');
    const portalLink = document.getElementById('nav-portal-link');
    const adminLink = document.getElementById('nav-admin-link');
    const superAdminLink = document.getElementById('nav-superadmin-link');
    
    if (state.user) {
        authLink.textContent = 'Logout';
        authLink.setAttribute('onclick', 'logout()');
        portalLink.style.display = 'inline-block';
        
        if (state.user.isAdmin) {
            superAdminLink.style.display = 'inline-block';
            adminLink.style.display = 'inline-block';
        } else {
            superAdminLink.style.display = 'none';
            adminLink.style.display = 'none';
        }
        
        // Update sidebar widgets
        document.querySelectorAll('.profile-email').forEach(el => el.textContent = state.user.email);
        document.querySelectorAll('.profile-avatar').forEach(el => el.textContent = state.user.email[0].toUpperCase());
        updateBalanceDisplay();
        
        const keyDisplay = document.getElementById('api-key-display');
        if (keyDisplay) keyDisplay.textContent = state.user.apiKey;
    } else {
        authLink.textContent = 'Developer Login';
        authLink.setAttribute('onclick', 'showView(\'auth\')');
        portalLink.style.display = 'none';
        adminLink.style.display = 'none';
        superAdminLink.style.display = 'none';
    }
    updatePlatformStats();
}

function updateBalanceDisplay() {
    if (!state.user) return;
    document.querySelectorAll('.profile-balance').forEach(el => {
        el.innerHTML = `<small>Wallet Balance</small>${state.user.balance.toFixed(2)} PKR`;
    });
}

// ─────────────────────────────────────────────────────────
//  Developer Portal Panes
// ─────────────────────────────────────────────────────────
function loadPortalData() {
    updateBalanceDisplay();
    renderUserLogs();
    
    // Reset inputs
    document.getElementById('api-search').value = '';
    
    // Direct menu pane
    showDashboardPane(state.currentDashboardPane || 'keys');
}

function renderSubscribedApis() {
    const grid = document.getElementById('subscribed-apis-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const purchased = state.apis.filter(api => isApiSubscribed(api.name) && api.tier !== 'Free');
    
    if (purchased.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
            <h4>You haven't purchased any premium APIs yet.</h4>
            <button class="btn btn-primary btn-sm" style="margin-top:1rem;" onclick="showView('explore')">Browse Marketplace</button>
        </div>`;
        return;
    }
    
    purchased.forEach(api => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-category">${api.category}</div>
            <div class="card-title">${api.name} <span class="badge badge-success">${api.tier}</span></div>
            <div class="card-desc">${api.description}</div>
            <div class="card-footer">
                <div class="api-price">${api.price_per_call.toFixed(2)} PKR / call</div>
                <button class="btn btn-primary btn-sm" onclick="tryApiSandbox('${api.name}')">Playground</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function initSubmitApiPane() {
    // Populate categories select dropdown
    const select = document.getElementById('submit-api-category');
    if (select) {
        select.innerHTML = '';
        const uniqueCats = Array.from(new Set(state.apis.map(a => a.category))).sort();
        uniqueCats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            select.appendChild(opt);
        });
    }
    
    // Clear inputs
    document.getElementById('submit-api-name').value = '';
    document.getElementById('submit-api-url').value = '';
    document.getElementById('submit-api-desc').value = '';
    document.getElementById('submit-api-auth').value = 'No';
    document.getElementById('submit-api-tier').value = 'Free';
    document.getElementById('submit-api-cost').value = '0.00';
    document.getElementById('submit-api-mock').value = '{\n  "status": "success",\n  "data": {\n    "message": "Custom Third-Party API Response"\n  }\n}';
}

function handleSubmitTierChange(tier) {
    const costInput = document.getElementById('submit-api-cost');
    if (tier === 'Free') {
        costInput.value = '0.00';
        costInput.readOnly = true;
    } else if (tier === 'Standard') {
        costInput.value = '0.05';
        costInput.readOnly = false;
    } else {
        costInput.value = '0.20';
        costInput.readOnly = false;
    }
}

function submitThirdPartyApi() {
    const name = document.getElementById('submit-api-name').value.trim();
    const category = document.getElementById('submit-api-category').value;
    const url = document.getElementById('submit-api-url').value.trim();
    const description = document.getElementById('submit-api-desc').value.trim();
    const auth = document.getElementById('submit-api-auth').value;
    const tier = document.getElementById('submit-api-tier').value;
    const cost = parseFloat(document.getElementById('submit-api-cost').value);
    const mockJson = document.getElementById('submit-api-mock').value.trim();
    
    if (!name || !url || !description || isNaN(cost)) {
        showNotification('Validation Error', 'All fields are required.', 'error');
        return;
    }
    
    try {
        JSON.parse(mockJson);
    } catch (e) {
        showNotification('JSON Syntax', 'Payload must be valid JSON.', 'error');
        return;
    }
    
    const submitted = JSON.parse(localStorage.getItem('agent_submitted_apis') || '[]');
    const newSubmission = {
        id: 'submitted_' + Date.now(),
        name,
        category,
        url,
        description,
        auth,
        tier,
        price_per_call: cost,
        mock_response: mockJson,
        user_email: state.user.email,
        timestamp: new Date().toISOString(),
        status: 'pending'
    };
    
    submitted.push(newSubmission);
    localStorage.setItem('agent_submitted_apis', JSON.stringify(submitted));
    
    showNotification('Submitted', 'Your API registry is queued for Super Admin approval.', 'success');
    initSubmitApiPane();
}

function renderUserLogs() {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const logs = JSON.parse(localStorage.getItem('agent_system_logs') || '[]');
    const userLogs = logs.filter(l => l.user_email === state.user.email);
    
    if (userLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">No API calls logged. Head to Sandbox and run tests.</td></tr>`;
        return;
    }
    
    // Sort descending
    userLogs.reverse().slice(0, 100).forEach(log => {
        const tr = document.createElement('tr');
        const time = new Date(log.timestamp).toLocaleTimeString();
        tr.innerHTML = `
            <td><strong>${log.api_name}</strong></td>
            <td><span class="badge ${log.status_code < 400 ? 'badge-success' : 'badge-danger'}">${log.status_code}</span></td>
            <td>${log.cost.toFixed(2)} PKR</td>
            <td>${time}</td>
        `;
        tbody.appendChild(tr);
    });
}

function devChangeEmail() {
    const newEmail = document.getElementById('dev-new-email').value.trim();
    const pass = document.getElementById('dev-email-confirm-pass').value;
    
    if (!newEmail || !pass) {
        showNotification('Validation Error', 'Email and password are required.', 'error');
        return;
    }
    
    if (pass !== state.user.password) {
        showNotification('Verification Error', 'Incorrect password confirmation.', 'error');
        return;
    }
    
    const db = JSON.parse(localStorage.getItem('agent_users_db'));
    const matchedIdx = db.findIndex(u => u.id === state.user.id);
    if (matchedIdx !== -1) {
        db[matchedIdx].email = newEmail;
        localStorage.setItem('agent_users_db', JSON.stringify(db));
        logout();
        showNotification('Saved', 'Email updated. Please log in again.', 'success');
    }
}

function devChangePassword() {
    const curr = document.getElementById('dev-current-pass').value;
    const next = document.getElementById('dev-new-pass').value;
    
    if (!curr || !next) {
        showNotification('Validation Error', 'Both current and new password required.', 'error');
        return;
    }
    
    if (curr !== state.user.password) {
        showNotification('Verification Error', 'Incorrect current password.', 'error');
        return;
    }
    
    const db = JSON.parse(localStorage.getItem('agent_users_db'));
    const matchedIdx = db.findIndex(u => u.id === state.user.id);
    if (matchedIdx !== -1) {
        db[matchedIdx].password = next;
        localStorage.setItem('agent_users_db', JSON.stringify(db));
        logout();
        showNotification('Saved', 'Password updated. Please log in again.', 'success');
    }
}

// ─────────────────────────────────────────────────────────
//  Interactive Sandbox Simulator (Gateway Proxy Interceptor)
// ─────────────────────────────────────────────────────────
function tryApiSandbox(apiName) {
    showView('portal');
    showDashboardPane('sandbox');
    
    const select = document.getElementById('sandbox-api-select');
    if (select) {
        select.value = apiName;
        select.dispatchEvent(new Event('change'));
    }
}

function initSandbox() {
    const select = document.getElementById('sandbox-api-select');
    if (!select) return;
    
    select.innerHTML = '';
    state.apis.forEach(api => {
        const opt = document.createElement('option');
        opt.value = api.name;
        opt.textContent = `${api.category} - ${api.name} (${api.price_per_call.toFixed(2)} PKR / call)`;
        select.appendChild(opt);
    });
    
    select.onchange = (e) => {
        const name = e.target.value;
        state.selectedSandboxApi = state.apis.find(a => a.name === name);
        updateSandboxCode();
    };
    
    if (state.apis.length > 0) {
        select.value = state.apis[0].name;
        state.selectedSandboxApi = state.apis[0];
        updateSandboxCode();
    }
}

function changeSandboxLanguage(lang) {
    state.sandboxLanguage = lang;
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.textContent.toLowerCase() === lang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    updateSandboxCode();
}

function updateSandboxCode() {
    const codePre = document.getElementById('sandbox-code');
    if (!codePre || !state.selectedSandboxApi) return;
    
    const apiName = state.selectedSandboxApi.name;
    const apiKey = state.user ? state.user.apiKey : 'YOUR_AGENT_API_KEY';
    const proxyUrl = `http://127.0.0.1:8000/api/proxy/${encodeURIComponent(apiName.replace(/ /g, '_'))}`;
    
    let code = '';
    if (state.sandboxLanguage === 'curl') {
        code = `curl -X GET "${proxyUrl}" \\\n  -H "X-Agent-API-Key: ${apiKey}"`;
    } else if (state.sandboxLanguage === 'javascript') {
        code = `fetch("${proxyUrl}", {\n  method: "GET",\n  headers: {\n    "X-Agent-API-Key": "${apiKey}"\n  }\n})\n.then(res => {\n  if (res.status === 402) alert("Top-up Required!");\n  return res.json();\n})\n.then(data => console.log(data))\n.catch(err => console.error(err));`;
    } else if (state.sandboxLanguage === 'python') {
        code = `import requests\n\nurl = "${proxyUrl}"\nheaders = {\n    "X-Agent-API-Key": "${apiKey}"\n}\n\nresponse = requests.get(url, headers=headers)\nif response.status_code == 402:\n    print("Payment Required: Balance insufficient")\nelse:\n    print(response.json())`;
    }
    
    codePre.textContent = code;
}

// SIMULATE BACKEND PROXY GATEWAY ROUTING
async function runSandboxRequest() {
    const outputTerminal = document.getElementById('sandbox-output');
    if (!outputTerminal || !state.selectedSandboxApi) return;
    
    if (!state.user) {
        showNotification('Authentication Error', 'Please log in to query API proxy.', 'error');
        return;
    }
    
    const api = state.selectedSandboxApi;
    outputTerminal.textContent = `// Querying Secure API Gateway Proxy...\n// API Key: ${state.user.apiKey}\n// Target: ${api.name}...\n`;
    outputTerminal.className = 'code-terminal output';
    
    try {
        const startTime = Date.now();
        const res = await fetch(`https://ai-agents-market-backend.khalidkhan.workers.dev/api/proxy/${encodeURIComponent(api.name.replace(/ /g, '_'))}`, {
            method: 'GET',
            headers: {
                'X-Agent-API-Key': state.user.apiKey
            }
        });
        const latency = Date.now() - startTime;
        const bodyText = await res.text();
        
        let bodyParsed;
        try {
            bodyParsed = JSON.stringify(JSON.parse(bodyText), null, 2);
        } catch (e) {
            bodyParsed = bodyText;
        }

        const proxyCost = res.headers.get('X-Proxy-Cost') || '0.00 PKR';
        const remainingBal = res.headers.get('X-Agent-Remaining-Balance') || '0.00 PKR';

        if (res.ok) {
            outputTerminal.innerHTML = `
<span style="color:#10b981;">&gt; HTTP/1.1 200 OK</span>
<span style="color:#94a3b8;">&gt; Time: ${latency} ms</span>
<span style="color:#10b981;">&gt; X-Proxy-Cost: ${proxyCost}</span>
<span style="color:#c084fc;">&gt; X-Agent-Remaining-Balance: ${remainingBal}</span>
<span style="color:#94a3b8;">&gt; Content-Type: application/json</span>

${bodyParsed}
            `;
            
            // Sync local wallet state balance
            const numericBal = parseFloat(remainingBal.replace(/[^0-9.]/g, ''));
            if (!isNaN(numericBal)) {
                state.user.balance = numericBal;
                localStorage.setItem('agent_user', JSON.stringify(state.user));
                updateBalanceDisplay();
            }
            showNotification('Credits Deducted', `Charged ${proxyCost} for proxy call.`, 'info');
        } else {
            outputTerminal.innerHTML = `
<span style="color:#ef4444;">&gt; HTTP/1.1 ${res.status} Error</span>
<span style="color:#94a3b8;">&gt; Time: ${latency} ms</span>

${bodyParsed}
            `;
            showNotification('Gateway Reject', 'Request blocked by Gateway proxy.', 'error');
        }
    } catch (e) {
        outputTerminal.textContent = '// Gateway Connection Error: Failed to reach gateway.';
        showNotification('Connection Error', 'Gateway proxy unreachable.', 'error');
    }
}

function logProxyCall(apiName, statusCode, cost) {
    const logs = JSON.parse(localStorage.getItem('agent_system_logs') || '[]');
    const newLog = {
        id: 'log_' + Date.now() + Math.random().toString(36).substring(2, 5),
        user_email: state.user.email,
        api_name: apiName,
        status_code: statusCode,
        cost: cost,
        timestamp: new Date().toISOString()
    };
    logs.push(newLog);
    localStorage.setItem('agent_system_logs', JSON.stringify(logs));
}

function generateCategoryMock(category, apiName) {
    // Check if it's a custom submitted API with its own custom mock response
    const submitted = JSON.parse(localStorage.getItem('agent_submitted_apis') || '[]');
    const customMatch = submitted.find(a => a.name === apiName && a.status === 'approved');
    if (customMatch && customMatch.mock_response) {
        try {
            return JSON.stringify(JSON.parse(customMatch.mock_response), null, 2);
        } catch (e) {}
    }
    
    const cat = category.toLowerCase();
    let dataObj = {};
    
    if (cat.includes('anim')) {
        dataObj = {
            "anime": "Jujutsu Kaisen",
            "character": "Satoru Gojo",
            "quote": "Don't worry, I'm the strongest.",
            "popularity_tier": "S-Class",
            "gateway_stamp": "MOCKED_RESPONSE"
        };
    } else if (cat.includes('crypto')) {
        dataObj = {
            "market_summary": "Crypto Index Prices",
            "tokens": [
                { "symbol": "BTC", "price_usd": 68429.20, "change_24h": "+2.4%" },
                { "symbol": "ETH", "price_usd": 3845.80, "change_24h": "+1.95%" },
                { "symbol": "SOL", "price_usd": 172.40, "change_24h": "-0.8%" }
            ],
            "timestamp": new Date().toISOString()
        };
    } else if (cat.includes('weather')) {
        dataObj = {
            "query_location": "Karachi, Pakistan",
            "temp_c": 32.5,
            "humidity": "68%",
            "wind_kph": 18.0,
            "condition": "Humid and Partly Cloudy",
            "alerts": "None"
        };
    } else if (cat.includes('financ') || cat.includes('business')) {
        dataObj = {
            "symbol": "AAPL",
            "market": "NASDAQ",
            "high": 183.92,
            "low": 180.88,
            "close": 182.41,
            "volume": 49201948,
            "currency": "USD"
        };
    } else if (cat.includes('geocod') || cat.includes('map')) {
        dataObj = {
            "location_name": "Lahore, Punjab, Pakistan",
            "coordinates": {
                "latitude": 31.5204,
                "longitude": 74.3587
            },
            "bounding_box": [31.34, 31.65, 74.15, 74.50],
            "confidence_score": 0.98
        };
    } else if (cat.includes('book') || cat.includes('dictionar')) {
        dataObj = {
            "title": "The Art of War",
            "author": "Sun Tzu",
            "genre": "Military Philosophy",
            "chapters": 13,
            "summary": "Ancient Chinese military treatise detailing tactics and strategies."
        };
    } else if (cat.includes('malware') || cat.includes('security')) {
        dataObj = {
            "target": "example_malicious_domain.com",
            "reputation": "malicious",
            "threat_type": "Phishing / Botnet Command",
            "risk_score": 94,
            "detections": {
                "google_safe_browsing": "flagged",
                "virustotal": "12/72 engines"
            }
        };
    } else if (cat.includes('anim')) {
        dataObj = {
            "species": "Axolotl",
            "fact": "Axolotls are neotenic, meaning they reach adulthood without undergoing metamorphosis.",
            "diet": "Carnivore",
            "status": "Critically Endangered"
        };
    } else {
        dataObj = {
            "proxy_integration": apiName,
            "category": category,
            "gateway_status": "OK",
            "description": "Standard simulated pay-as-you-go middleware callback.",
            "data_payload": {
                "items": [1, 2, 3],
                "active_state": true,
                "token_handshake": "success"
            }
        };
    }
    
    return JSON.stringify(dataObj, null, 2);
}

// ─────────────────────────────────────────────────────────
//  Easypaisa Webhook Handshake Simulation
// ─────────────────────────────────────────────────────────
function openTopupModal() {
    if (!state.user) {
        showNotification('Login Required', 'Please log in to perform topups.', 'error');
        return;
    }
    document.getElementById('topup-modal').style.display = 'flex';
}

function closeTopupModal() {
    document.getElementById('topup-modal').style.display = 'none';
}

async function handleTopupSubmit() {
    const amount = parseFloat(document.getElementById('topup-amount').value);
    
    if (isNaN(amount) || amount <= 0) {
        showNotification('Validation Error', 'Please enter a valid amount in PKR.', 'error');
        return;
    }
    
    const orderId = 'EP_TX_' + Date.now().toString().substring(6) + Math.floor(Math.random() * 100);
    
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/topup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userEmail: state.user.email,
                amount,
                orderId,
                refNumber: ''
            })
        });
        if (!res.ok) {
            showNotification('Gateway Error', 'Failed to register topup ticket.', 'error');
            return;
        }
        
        closeTopupModal();
        showNotification('Redirecting', 'Opening Easypaisa Checkout Portal...', 'info');
        
        setTimeout(() => {
            window.location.href = `easypaisa_mock.html?amount=${amount}&orderId=${orderId}&email=${encodeURIComponent(state.user.email)}&storeId=629401&storeName=AgentAPIs`;
        }, 1000);
    } catch (e) {
        showNotification('Connection Error', 'Backend topup server unreachable', 'error');
    }
}

// ─────────────────────────────────────────────────────────
//  Super Admin Control Center Panel
// ─────────────────────────────────────────────────────────
async function superAdminLogin() {
    const email = document.getElementById('sa-login-email').value.trim();
    const pass = document.getElementById('sa-login-password').value;
    
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
        });
        const data = await res.json();
        if (res.ok && data.user && data.user.isAdmin) {
            state.user = data.user;
            localStorage.setItem('agent_user', JSON.stringify(data.user));
            showNotification('Admin Granted', 'Access approved. Welcome back Admin.', 'success');
            updateUserUI();
            showView('superadmin');
        } else {
            showNotification('Security Reject', 'Invalid Super Admin credentials or privileges.', 'error');
        }
    } catch (e) {
        showNotification('Connection Error', 'Failed to reach admin gateway.', 'error');
    }
}

function superAdminLogout() {
    logout();
}

function loadSuperAdminData() {
    showAdminPane(state.currentAdminPane || 'sa-overview');
}

async function renderSuperAdminOverview() {
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/admin/overview');
        const data = await res.json();
        if (res.ok) {
            document.getElementById('sa-stat-revenue').textContent = `PKR ${data.revenue.toFixed(2)}`;
            document.getElementById('sa-stat-agents').textContent = data.users;
            document.getElementById('sa-stat-pending').textContent = data.pending;
            document.getElementById('sa-stat-calls').textContent = data.calls;
        }
        
        // Settings fallback
        const num = localStorage.getItem('agent_ep_number') || '03001234567';
        const name = localStorage.getItem('agent_ep_name') || 'Muhammad Khalid';
        document.getElementById('sa-ep-number-text').textContent = `${num} (&nbsp;${name})`;
    } catch (e) {
        showNotification('Error', 'Failed to load system stats.', 'error');
    }
}

// Payment Ticket Queues
async function renderPaymentQueue() {
    const filter = document.getElementById('payment-status-filter').value;
    const list = document.getElementById('payment-queue-list');
    if (!list) return;
    list.innerHTML = '';
    
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/admin/payments');
        const payments = await res.json();
        
        const filtered = payments.filter(p => filter === 'all' || p.status === filter);
        
        if (filtered.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted);">No payments matching status logic.</div>`;
            return;
        }
        
        filtered.forEach(pay => {
            const div = document.createElement('div');
            div.className = 'payment-queue-card settings-section';
            div.style.border = '1px solid var(--border-glass)';
            div.style.padding = '1.25rem';
            div.style.marginBottom = '1rem';
            div.style.borderRadius = 'var(--radius-md)';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            
            let actions = '';
            if (pay.status === 'pending') {
                actions = `
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn btn-primary btn-sm" onclick="approvePayment('${pay.orderId}')">Approve</button>
                        <button class="btn btn-danger btn-sm" onclick="rejectPayment('${pay.orderId}')">Reject</button>
                    </div>
                `;
            } else {
                actions = `<span class="badge ${pay.status === 'approved' ? 'badge-success' : 'badge-danger'}">${pay.status}</span>`;
            }
            
            div.innerHTML = `
                <div>
                    <strong>${pay.user_email}</strong><br>
                    <small style="color:var(--text-muted);">OrderId: ${pay.orderId} | Ref: ${pay.ref_number || 'none'}</small><br>
                    <span style="font-family:var(--font-mono); font-weight:700; color:var(--color-success);">${pay.amount.toFixed(2)} PKR</span>
                </div>
                <div>
                    ${actions}
                </div>
            `;
            list.appendChild(div);
        });
    } catch (e) {
        list.innerHTML = '<div style="color:var(--color-danger); text-align:center;">Failed to load payments from gateway.</div>';
    }
}

async function approvePayment(orderId) {
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/admin/payments/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId })
        });
        if (res.ok) {
            showNotification('Payment Approved', 'Credited user wallet successfully', 'success');
            renderPaymentQueue();
        } else {
            showNotification('Error', 'Failed to approve payment ticket.', 'error');
        }
    } catch (e) {
        showNotification('Connection Error', 'Gateway admin server unreachable.', 'error');
    }
}

async function rejectPayment(orderId) {
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/admin/payments/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId })
        });
        if (res.ok) {
            showNotification('Payment Rejected', `Order ID ${orderId} marked rejected.`, 'info');
            renderPaymentQueue();
        }
    } catch (e) {
        showNotification('Connection Error', 'Failed to contact gateway.', 'error');
    }
}

function logIncomingPayment() {
    const email = document.getElementById('new-payment-email').value.trim();
    const amount = parseFloat(document.getElementById('new-payment-usd').value);
    const ref = document.getElementById('new-payment-ref').value.trim();
    
    if (!email || isNaN(amount) || amount <= 0) {
        showNotification('Validation Error', 'Enter valid user email and positive amount.', 'error');
        return;
    }
    
    const db = JSON.parse(localStorage.getItem('agent_users_db'));
    const user = db.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        showNotification('Error', 'User account does not exist.', 'error');
        return;
    }
    
    const payments = JSON.parse(localStorage.getItem('agent_payments') || '[]');
    const newPay = {
        orderId: 'EP_ADMIN_' + Date.now().toString().substring(8),
        user_email: email,
        amount: amount,
        status: 'pending',
        ref_number: ref,
        timestamp: new Date().toISOString()
    };
    payments.push(newPay);
    localStorage.setItem('agent_payments', JSON.stringify(payments));
    
    document.getElementById('new-payment-email').value = '';
    document.getElementById('new-payment-usd').value = '';
    document.getElementById('new-payment-ref').value = '';
    
    showNotification('Logged', 'New receipt added to pending lists.', 'success');
    renderPaymentQueue();
}

// User Submitted APIs approvals pane
function renderSubmittedApisReview() {
    const list = document.getElementById('submitted-apis-list');
    if (!list) return;
    list.innerHTML = '';
    
    const submitted = JSON.parse(localStorage.getItem('agent_submitted_apis') || '[]');
    const pending = submitted.filter(s => s.status === 'pending');
    
    if (pending.length === 0) {
        list.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">No pending API submissions to review.</div>`;
        return;
    }
    
    pending.forEach(api => {
        const card = document.createElement('div');
        card.className = 'card settings-section';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '0.5rem';
        
        card.innerHTML = `
            <div class="card-category">${api.category} (Submitted by ${api.user_email})</div>
            <div class="card-title">${api.name} <span class="badge badge-warning">${api.tier}</span></div>
            <p style="font-size:0.85rem; color:var(--text-muted);">${api.description}</p>
            <p style="font-size:0.85rem;"><strong>Endpoint URL:</strong> <code>${api.url}</code></p>
            <pre style="background:var(--bg-base); font-size:0.75rem; padding:0.5rem; border-radius:var(--radius-sm); overflow-x:auto;">${api.mock_response}</pre>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.75rem;">
                <button class="btn btn-primary btn-sm" onclick="approveSubmittedApi('${api.id}')">Approve & Publish</button>
                <button class="btn btn-danger btn-sm" onclick="rejectSubmittedApi('${api.id}')">Reject</button>
            </div>
        `;
        list.appendChild(card);
    });
}

function approveSubmittedApi(apiId) {
    const submitted = JSON.parse(localStorage.getItem('agent_submitted_apis') || '[]');
    const approvedList = JSON.parse(localStorage.getItem('agent_approved_apis') || '[]');
    
    const idx = submitted.findIndex(s => s.id === apiId);
    if (idx === -1) return;
    
    const api = submitted[idx];
    api.status = 'approved';
    
    // Add to approved listing and update main catalog
    const newApi = {
        name: api.name,
        category: api.category,
        description: api.description,
        url: api.url,
        auth: api.auth,
        https: "Yes",
        cors: "Yes",
        tier: api.tier,
        price_per_call: api.price_per_call,
        is_active: true,
        mock_response: api.mock_response
    };
    
    approvedList.push(newApi);
    submitted[idx] = api;
    
    localStorage.setItem('agent_submitted_apis', JSON.stringify(submitted));
    localStorage.setItem('agent_approved_apis', JSON.stringify(approvedList));
    
    // Refresh active listing
    state.apis = [...APIS_DATA, ...approvedList];
    
    showNotification('API Approved', `${api.name} has been published to catalog!`, 'success');
    renderSubmittedApisReview();
}

function rejectSubmittedApi(apiId) {
    const submitted = JSON.parse(localStorage.getItem('agent_submitted_apis') || '[]');
    const idx = submitted.findIndex(s => s.id === apiId);
    if (idx === -1) return;
    
    submitted[idx].status = 'rejected';
    localStorage.setItem('agent_submitted_apis', JSON.stringify(submitted));
    
    showNotification('API Rejected', 'Submission marked rejected.', 'info');
    renderSubmittedApisReview();
}

// Agent Accounts Manager table
async function renderAgentTable() {
    const query = document.getElementById('agent-search').value.toLowerCase();
    const tbody = document.getElementById('sa-agents-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/admin/agents');
        const agents = await res.json();
        
        const filtered = agents.filter(u => u.email.toLowerCase().includes(query));
        
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem;">No developer agents found.</td></tr>`;
            return;
        }
        
        filtered.forEach(usr => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${usr.email}</strong></td>
                <td><code>${usr.apiKey}</code></td>
                <td>${usr.balance.toFixed(2)} PKR</td>
                <td>Verified database user</td>
                <td>N/A</td>
                <td><span class="badge badge-success">Active</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="adjustUserBalancePrompt('${usr.id}')">Add Credits</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--color-danger);">Failed to load agents from gateway.</td></tr>`;
    }
}

async function adjustUserBalancePrompt(userId) {
    const amtStr = prompt("Enter amount in PKR to add to user wallet balance:");
    if (amtStr === null) return;
    
    const amt = parseFloat(amtStr);
    if (isNaN(amt) || amt <= 0) {
        alert("Please enter a valid positive credits amount.");
        return;
    }
    
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/admin/agents/credit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, amount: amt })
        });
        if (res.ok) {
            showNotification('Balance Updated', `Added ${amt} PKR to developer wallet.`, 'success');
            renderAgentTable();
        }
    } catch (e) {
        showNotification('Error', 'Failed to credit wallet.', 'error');
    }
}

// Global System Audit logs
async function renderAdminTransactions() {
    const userFilter = document.getElementById('tx-user-filter').value.toLowerCase();
    const apiFilter = document.getElementById('tx-api-filter').value.toLowerCase();
    const statusFilter = document.getElementById('tx-status-filter').value;
    
    const tbody = document.getElementById('sa-tx-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/admin/logs');
        const logs = await res.json();
        
        const filtered = logs.filter(l => {
            const matchesUser = l.user_email.toLowerCase().includes(userFilter);
            const matchesApi = l.api_name.toLowerCase().includes(apiFilter);
            
            let matchesStatus = true;
            if (statusFilter === 'success') matchesStatus = (l.status_code === 200);
            if (statusFilter === 'error') matchesStatus = (l.status_code >= 400);
            
            return matchesUser && matchesApi && matchesStatus;
        });
        
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem;">No transaction proxy logs found.</td></tr>`;
            return;
        }
        
        filtered.forEach(log => {
            const tr = document.createElement('tr');
            const time = new Date(log.timestamp).toLocaleString();
            tr.innerHTML = `
                <td>${log.user_email}</td>
                <td><strong>${log.api_name}</strong></td>
                <td><span class="badge ${log.status_code < 400 ? 'badge-success' : 'badge-danger'}">${log.status_code}</span></td>
                <td>${log.cost.toFixed(2)} PKR</td>
                <td>${time}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--color-danger);">Failed to load proxy audit logs.</td></tr>`;
    }
}

// Admin Catalog pricing adjust table
function renderCatalogTable() {
    const tbody = document.getElementById('sa-catalog-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    state.apis.forEach(api => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${api.name}</strong></td>
            <td>${api.category}</td>
            <td>
                <input type="number" step="0.01" value="${api.price_per_call}" class="form-control" style="width:110px; padding:0.25rem 0.5rem;" id="catalog-price-${api.name.replace(/ /g, '_')}">
            </td>
            <td>
                <span class="badge ${api.is_active ? 'badge-success' : 'badge-danger'}">${api.is_active ? 'Online' : 'Offline'}</span>
            </td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="saveAdminPriceOverride('${api.name}')">Save</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveAdminPriceOverride(apiName) {
    const inputId = `catalog-price-${apiName.replace(/ /g, '_')}`;
    const newPrice = parseFloat(document.getElementById(inputId).value);
    
    if (isNaN(newPrice) || newPrice < 0) {
        showNotification('Validation Error', 'Enter a valid price.', 'error');
        return;
    }
    
    try {
        const res = await fetch('https://ai-agents-market-backend.khalidkhan.workers.dev/api/admin/catalog/price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiName, price: newPrice })
        });
        if (res.ok) {
            // Update local state and UI
            const idx = state.apis.findIndex(a => a.name === apiName);
            if (idx !== -1) {
                state.apis[idx].price_per_call = newPrice;
            }
            showNotification('Price Saved', `${apiName} call price adjusted to ${newPrice.toFixed(2)} PKR`, 'success');
            renderCatalogTable();
        }
    } catch (e) {
        showNotification('Error', 'Failed to update catalog pricing.', 'error');
    }
}

function renderAdminSettings() {
    document.getElementById('sa-settings-ep-text').textContent = localStorage.getItem('agent_ep_number');
    document.getElementById('sa-new-ep-number').value = localStorage.getItem('agent_ep_number');
    document.getElementById('sa-ep-account-name').value = localStorage.getItem('agent_ep_name');
}

function saveEasypaisaNumber() {
    const num = document.getElementById('sa-new-ep-number').value.trim();
    const name = document.getElementById('sa-ep-account-name').value.trim();
    
    if (!num || !name) {
        showNotification('Validation Error', 'Easypaisa number and account holder name required.', 'error');
        return;
    }
    
    localStorage.setItem('agent_ep_number', num);
    localStorage.setItem('agent_ep_name', name);
    showNotification('Saved', 'Easypaisa routing parameters updated.', 'success');
    renderAdminSettings();
}

function saChangeEmail() {
    const email = document.getElementById('sa-new-email').value.trim();
    const pass = document.getElementById('sa-email-pass').value;
    
    if (!email || !pass) {
        showNotification('Validation Error', 'Email and confirm password required.', 'error');
        return;
    }
    
    if (pass !== state.user.password) {
        showNotification('Verification Error', 'Confirm password mismatch.', 'error');
        return;
    }
    
    const db = JSON.parse(localStorage.getItem('agent_users_db'));
    const idx = db.findIndex(u => u.id === state.user.id);
    if (idx !== -1) {
        db[idx].email = email;
        localStorage.setItem('agent_users_db', JSON.stringify(db));
        logout();
        showNotification('Email Changed', 'Super Admin updated. Please log in again.', 'success');
    }
}

function saChangePassword() {
    const curr = document.getElementById('sa-current-pass').value;
    const next = document.getElementById('sa-new-pass').value;
    
    if (!curr || !next) {
        showNotification('Validation Error', 'Required passwords fields blank.', 'error');
        return;
    }
    
    if (curr !== state.user.password) {
        showNotification('Verification Error', 'Incorrect current password.', 'error');
        return;
    }
    
    const db = JSON.parse(localStorage.getItem('agent_users_db'));
    const idx = db.findIndex(u => u.id === state.user.id);
    if (idx !== -1) {
        db[idx].password = next;
        localStorage.setItem('agent_users_db', JSON.stringify(db));
        logout();
        showNotification('Password Changed', 'Super Admin password updated. Log in again.', 'success');
    }
}

// ─────────────────────────────────────────────────────────
//  Copy Utilities & Toast Notifications
// ─────────────────────────────────────────────────────────
function copyApiKey() {
    const keyBox = document.getElementById('api-key-display');
    if (!keyBox) return;
    
    navigator.clipboard.writeText(keyBox.textContent)
        .then(() => showNotification('Copied', 'Agent Proxy API Key copied to clipboard!', 'success'))
        .catch(() => showNotification('Error', 'Failed to copy API key', 'error'));
}

function showNotification(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div>
            <strong style="display:block; font-size:0.9rem;">${title}</strong>
            <span style="font-size:0.8rem; color:var(--text-muted);">${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Page load event
window.addEventListener('DOMContentLoaded', () => {
    initSession();
    
    // Search input listener
    const search = document.getElementById('api-search');
    if (search) {
        search.addEventListener('input', (e) => handleSearchInput(e.target.value));
    }
});
