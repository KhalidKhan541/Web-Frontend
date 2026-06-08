// ─────────────────────────────────────────────────────────
//  API Base URL Configuration
//  When running locally or on Railway/Render: leave as ''
//  For Cloudflare Pages frontend-only deploy, set to your backend:
//  const API_BASE = 'https://agentapis.up.railway.app';
// ─────────────────────────────────────────────────────────
const API_BASE = 'https://web-khalid-khan-541.vercel.app/';

// App State
const state = {
    user: null,
    apis: [],
    categories: [],
    currentView: 'home',
    currentDashboardPane: 'keys',
    selectedSandboxApi: null,
    sandboxLanguage: 'curl',
    searchQuery: '',
    categoryFilter: 'All'
};

// Check for existing session on load
function initSession() {
    const savedUser = localStorage.getItem('agent_user');
    if (savedUser) {
        state.user = JSON.parse(savedUser);
        updateUserUI();
        pollUserBalance(); // Refresh balance
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
        loadApis();
    } else if (viewId === 'portal') {
        if (!state.user) {
            showView('auth');
        } else {
            loadPortalData();
        }
    } else if (viewId === 'admin') {
        if (!state.user || !state.user.isAdmin) {
            showNotification('Error', 'Access denied. Administrator privileges required.', 'error');
            showView('home');
        } else {
            loadAdminData();
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
    
    document.getElementById(`${paneId}-pane`).classList.add('active');
    event.currentTarget.classList.add('active');

    if (paneId === 'sandbox') {
        initSandbox();
    } else if (paneId === 'transactions') {
        loadPortalData();
    }
}

// Toggle Theme (Light/Dark Mode)
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

// API Loading & Catalog Rendering
async function loadApis() {
    try {
        const res = await fetch(`${API_BASE}/api/apis`);
        if (!res.ok) throw new Error("Failed to load APIs");
        state.apis = await res.json();
        
        // Extract unique categories
        const cats = new Set(state.apis.map(a => a.category));
        state.categories = ['All', ...Array.from(cats).sort()];
        
        renderCategoryFilter();
        renderApis();
    } catch (e) {
        showNotification('Error', e.message, 'error');
    }
}

function renderCategoryFilter() {
    const filter = document.getElementById('category-filter');
    if (!filter) return;
    
    // Save current selection
    const currentVal = filter.value;
    
    filter.innerHTML = '';
    state.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filter.appendChild(opt);
    });
    
    if (state.categories.includes(currentVal)) {
        filter.value = currentVal;
    }
}

function renderApis() {
    const container = document.getElementById('apis-grid');
    if (!container) return;
    
    container.innerHTML = '';
    
    const filtered = state.apis.filter(api => {
        const matchesSearch = api.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                             api.description.toLowerCase().includes(state.searchQuery.toLowerCase());
        const matchesCategory = state.categoryFilter === 'All' || api.category === state.categoryFilter;
        return matchesSearch && matchesCategory;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
            <h3>No APIs found matching search criteria.</h3>
        </div>`;
        return;
    }
    
    filtered.forEach(api => {
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
                <button class="btn btn-primary btn-sm" onclick="tryApiSandbox('${api.name}')">Try It</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function handleSearch(val) {
    state.searchQuery = val;
    renderApis();
}

function handleCategoryFilter(val) {
    state.categoryFilter = val;
    renderApis();
}

// Authentication Flow
async function handleAuth(type) {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    
    if (!email || !password) {
        showNotification('Validation', 'Please enter email and password', 'error');
        return;
    }
    
    const url = type === 'login' ? `${API_BASE}/api/login` : `${API_BASE}/api/register`;
    
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Authentication failed");
        
        state.user = {
            id: data.user_id,
            email: data.email,
            apiKey: data.api_key,
            balance: data.balance !== undefined ? data.balance : 50.0, // Default signup credit
            isAdmin: data.is_admin || 0
        };
        
        localStorage.setItem('agent_user', JSON.stringify(state.user));
        updateUserUI();
        showNotification('Success', data.message || `Welcome back, ${data.email}!`, 'success');
        
        // Redirect to dev portal
        showView('portal');
    } catch (e) {
        showNotification('Auth Failure', e.message, 'error');
    }
}

function logout() {
    state.user = null;
    localStorage.removeItem('agent_user');
    updateUserUI();
    showNotification('Logout', 'Successfully logged out.', 'info');
    showView('home');
}

function updateUserUI() {
    const authLink = document.getElementById('nav-auth-link');
    const portalLink = document.getElementById('nav-portal-link');
    const adminLink = document.getElementById('nav-admin-link');
    
    if (state.user) {
        authLink.textContent = 'Logout';
        authLink.setAttribute('onclick', 'logout()');
        portalLink.style.display = 'inline-block';
        
        // Show Admin link if user is admin
        if (state.user.isAdmin) {
            adminLink.style.display = 'inline-block';
        } else {
            adminLink.style.display = 'none';
        }
        
        // Update dashboard elements
        document.querySelectorAll('.profile-email').forEach(el => el.textContent = state.user.email);
        document.querySelectorAll('.profile-avatar').forEach(el => el.textContent = state.user.email[0].toUpperCase());
        updateBalanceDisplay();
        
        const keyBox = document.getElementById('api-key-display');
        if (keyBox) keyBox.textContent = state.user.apiKey;
    } else {
        authLink.textContent = 'Developer Login';
        authLink.setAttribute('onclick', 'showView(\'auth\')');
        portalLink.style.display = 'none';
        adminLink.style.display = 'none';
    }
}

function updateBalanceDisplay() {
    document.querySelectorAll('.profile-balance').forEach(el => {
        el.innerHTML = `<small>Wallet Balance</small>${state.user.balance.toFixed(2)} PKR`;
    });
}

async function pollUserBalance() {
    if (!state.user) return;
    try {
        const res = await fetch(`${API_BASE}/api/user/info?user_id=${state.user.id}`);
        if (res.ok) {
            const data = await res.json();
            state.user.balance = data.user.balance;
            localStorage.setItem('agent_user', JSON.stringify(state.user));
            updateBalanceDisplay();
            
            // Re-render logs in developer portal
            renderLogs(data.logs);
        }
    } catch (e) {
        console.error("Failed to poll user info", e);
    }
}

function renderLogs(logs) {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No usage logs recorded yet. Create an agent and test proxy calls.</td></tr>`;
        return;
    }
    
    logs.forEach(log => {
        const tr = document.createElement('tr');
        const date = new Date(log.timestamp).toLocaleTimeString();
        tr.innerHTML = `
            <td>${log.api_name}</td>
            <td><span class="badge ${log.status_code < 400 ? 'badge-success' : 'badge-danger'}">${log.status_code}</span></td>
            <td>${log.cost.toFixed(2)} PKR</td>
            <td>${date}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Developer Portal Pages Data Loader
async function loadPortalData() {
    try {
        const res = await fetch(`${API_BASE}/api/user/info?user_id=${state.user.id}`);
        if (!res.ok) throw new Error("Failed to load user info");
        const data = await res.json();
        
        state.user.balance = data.user.balance;
        updateBalanceDisplay();
        renderLogs(data.logs);
        
        // Load recent transactions
        const txRes = await fetch(`${API_BASE}/api/user/info?user_id=${state.user.id}`); // For simplicity we get logs, let's load transactions from same or build separate if needed.
        // We'll simulate transactions listing directly from the database in a future step, or render current logs as transactions if needed.
    } catch (e) {
        showNotification('Error', e.message, 'error');
    }
}

// Admin Console Data Loader
async function loadAdminData() {
    try {
        const res = await fetch(`${API_BASE}/api/apis`);
        if (!res.ok) throw new Error("Failed to load catalog");
        const apis = await res.json();
        
        const tbody = document.getElementById('admin-catalog-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        apis.forEach(api => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${api.name}</strong><br><small style="color:var(--text-muted);">${api.category}</small></td>
                <td>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <input type="number" step="0.01" class="form-control form-control-sm" style="width:100px; padding:0.25rem 0.5rem;" 
                               value="${api.price_per_call}" id="price-input-${api.name.replace(/ /g, '_')}">
                        <span>PKR</span>
                    </div>
                </td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="saveApiPrice('${api.name}')">Save</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Load audit logs
        const logsRes = await fetch(`${API_BASE}/api/admin/logs?user_id=${state.user.id}`);
        if (!logsRes.ok) throw new Error("Failed to fetch system logs");
        const systemLogs = await logsRes.json();
        
        const auditTbody = document.getElementById('admin-audit-tbody');
        if (auditTbody) {
            auditTbody.innerHTML = '';
            if (systemLogs.length === 0) {
                auditTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No API calls logged.</td></tr>`;
                return;
            }
            systemLogs.forEach(log => {
                const tr = document.createElement('tr');
                const time = new Date(log.timestamp).toLocaleString();
                tr.innerHTML = `
                    <td>${log.user_email}</td>
                    <td>${log.api_name}</td>
                    <td><span class="badge ${log.status_code < 400 ? 'badge-success' : 'badge-danger'}">${log.status_code}</span></td>
                    <td>${log.cost.toFixed(2)} PKR</td>
                    <td>${time}</td>
                `;
                auditTbody.appendChild(tr);
            });
        }
    } catch (e) {
        showNotification('Error', e.message, 'error');
    }
}

async function saveApiPrice(apiName) {
    const inputId = `price-input-${apiName.replace(/ /g, '_')}`;
    const price = parseFloat(document.getElementById(inputId).value);
    
    if (isNaN(price) || price < 0) {
        showNotification('Validation Error', 'Please enter a valid price', 'error');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/apis/price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: apiName, price })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail);
        
        showNotification('Success', data.message, 'success');
        loadAdminData(); // Refresh list
    } catch (e) {
        showNotification('Error', e.message, 'error');
    }
}

// Interactive Code Sandbox Simulator
function tryApiSandbox(apiName) {
    showView('portal');
    showDashboardPane('sandbox');
    
    const select = document.getElementById('sandbox-api-select');
    if (select) {
        // Find option and select it
        select.value = apiName;
        select.dispatchEvent(new Event('change'));
    }
}

function initSandbox() {
    const select = document.getElementById('sandbox-api-select');
    if (!select) return;
    
    select.innerHTML = '';
    
    // Populate select options
    state.apis.forEach(api => {
        const opt = document.createElement('option');
        opt.value = api.name;
        opt.textContent = `${api.category} - ${api.name} (${api.price_per_call.toFixed(2)} PKR / call)`;
        select.appendChild(opt);
    });
    
    select.addEventListener('change', (e) => {
        const apiName = e.target.value;
        state.selectedSandboxApi = state.apis.find(a => a.name === apiName);
        updateSandboxCode();
    });
    
    if (state.apis.length > 0) {
        select.value = state.apis[0].name;
        state.selectedSandboxApi = state.apis[0];
        updateSandboxCode();
    }
}

function changeSandboxLanguage(lang) {
    state.sandboxLanguage = lang;
    
    // Toggle active state on language buttons
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
    const apiKey = state.user ? state.user.apiKey : 'YOUR_API_KEY';
    const proxyUrl = `${window.location.origin}/api/proxy/${encodeURIComponent(apiName)}`;
    
    let code = '';
    if (state.sandboxLanguage === 'curl') {
        code = `curl -X GET "${proxyUrl}" \\\n  -H "X-Agent-API-Key: ${apiKey}"`;
    } else if (state.sandboxLanguage === 'javascript') {
        code = `fetch("${proxyUrl}", {\n  method: "GET",\n  headers: {\n    "X-Agent-API-Key": "${apiKey}"\n  }\n})\n.then(res => res.json())\n.then(data => console.log(data))\n.catch(err => console.error(err));`;
    } else if (state.sandboxLanguage === 'python') {
        code = `import requests\n\nurl = "${proxyUrl}"\nheaders = {\n    "X-Agent-API-Key": "${apiKey}"\n}\n\nresponse = requests.get(url, headers=headers)\nprint(response.json())`;
    }
    
    codePre.textContent = code;
}

async function runSandboxRequest() {
    const outputTerminal = document.getElementById('sandbox-output');
    if (!outputTerminal || !state.selectedSandboxApi) return;
    
    if (!state.user) {
        showNotification('Auth Error', 'You must log in to execute requests.', 'error');
        return;
    }
    
    outputTerminal.textContent = '// Sending request to API Proxy...\n// Intercepting token headers and checking balance...\n';
    outputTerminal.className = 'code-terminal output';
    
    const apiName = state.selectedSandboxApi.name;
    const proxyUrl = `/api/proxy/${encodeURIComponent(apiName)}`;
    
    try {
        const start = performance.now();
        const res = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'X-Agent-API-Key': state.user.apiKey
            }
        });
        
        const end = performance.now();
        const duration = (end - start).toFixed(0);
        
        const cost = res.headers.get('X-Proxy-Cost') || `${state.selectedSandboxApi.price_per_call.toFixed(2)} PKR`;
        const remaining = res.headers.get('X-Agent-Remaining-Balance');
        
        let bodyText = await res.text();
        try {
            // Attempt to format json
            const parsed = JSON.parse(bodyText);
            bodyText = JSON.stringify(parsed, null, 2);
        } catch (err) {}
        
        outputTerminal.innerHTML = `
<span style="color:#10b981;">&gt; HTTP/1.1 ${res.status} ${res.statusText}</span>
<span style="color:#94a3b8;">&gt; Time: ${duration} ms</span>
<span style="color:#f59e0b;">&gt; X-Proxy-Cost: ${cost}</span>
${remaining ? `<span style="color:#c084fc;">&gt; X-Agent-Remaining-Balance: ${remaining}</span>` : ''}
<span style="color:#94a3b8;">&gt; Content-Type: ${res.headers.get('content-type') || 'application/json'}</span>

${bodyText}
        `;
        
        // Refresh balance in state and UI
        pollUserBalance();
    } catch (e) {
        outputTerminal.textContent = `Error calling API proxy: ${e.message}`;
    }
}

// Easypaisa Checkout modal actions
function openTopupModal() {
    if (!state.user) {
        showNotification('Login required', 'Please log in to top up your wallet', 'error');
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
        showNotification('Validation Error', 'Please enter a valid positive amount in PKR.', 'error');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/api/payment/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, user_id: state.user.id })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Checkout session failed to start");
        
        closeTopupModal();
        showNotification('Redirecting', 'Redirecting to Easypaisa payment page...', 'info');
        
        // Redirect the page to the checkout page
        setTimeout(() => {
            window.location.href = data.redirect_url;
        }, 1000);
        
    } catch (e) {
        showNotification('Checkout Error', e.message, 'error');
    }
}

// Copy Utilities
function copyApiKey() {
    const keyBox = document.getElementById('api-key-display');
    if (!keyBox) return;
    
    navigator.clipboard.writeText(keyBox.textContent)
        .then(() => showNotification('Copied', 'API Key copied to clipboard!', 'success'))
        .catch(() => showNotification('Error', 'Failed to copy API key', 'error'));
}

// Toast Notifications System
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
    
    // Search input event listener
    const search = document.getElementById('api-search');
    if (search) {
        search.addEventListener('input', (e) => handleSearch(e.target.value));
    }
});
