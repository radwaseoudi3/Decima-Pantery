(() => {
  'use strict';

  const APP_KEY = 'decimaPantryLiveServerV1';
  const SESSION_KEY = 'decimaPantryStaffSession';
  const EMPLOYEE_KEY = 'decimaPantryEmployeeName';
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('decima-pantry-live') : null;

  const STAFF = {
    barista: { username: 'barista', password: 'Coffee123!', role: 'Barista' },
    admin: { username: 'admin', password: 'Decima123!', role: 'Admin' }
  };

  const icons = {
    'Regular Coffee': '☕', 'Coffee with Milk': '☕', 'Black Nescafe': '☕', 'Nescafe with Milk': '🥛',
    'Regular Tea': '🍵', 'Milk Tea': '🍵', 'Ginger & Lemon': '🍋', 'Anise': '🌿',
    'Mint Tea': '🍃', 'Hibiscus': '🌺', 'Green Tea': '🍵', 'Cumin & Lemon': '🍋', 'Mint': '🍃'
  };

  const descriptions = {
    'Regular Coffee': ['Coffee', 'Classic, rich and simple.'],
    'Coffee with Milk': ['Coffee', 'Smooth coffee finished with milk.'],
    'Black Nescafe': ['Coffee', 'Bold instant coffee without milk.'],
    'Nescafe with Milk': ['Coffee', 'Creamy and comforting.'],
    'Regular Tea': ['Tea', 'Traditional tea, served warm.'],
    'Milk Tea': ['Tea', 'Classic tea with warm milk.'],
    'Ginger & Lemon': ['Herbal', 'Warm ginger with a fresh lemon finish.'],
    'Anise': ['Herbal', 'A soothing herbal cup.'],
    'Mint Tea': ['Tea', 'Refreshing tea with mint.'],
    'Hibiscus': ['Herbal', 'Bright hibiscus infusion.'],
    'Green Tea': ['Tea', 'Light and refreshing green tea.'],
    'Cumin & Lemon': ['Herbal', 'Warm cumin with lemon.'],
    'Mint': ['Herbal', 'Fresh mint infusion.']
  };

  const nowIso = () => new Date().toISOString();
  const uid = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fmt = n => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  const unitShort = unit => ({ Gram: 'g', Milliliter: 'ml', Piece: 'pc' }[unit] || unit);

  function defaultData() {
    const materials = [
      ['coffee', 'Coffee', 'Gram', 'Bag', 1000, 1800, 250],
      ['nescafe', 'Nescafe', 'Gram', 'Jar', 500, 900, 120],
      ['tea', 'Tea', 'Gram', 'Box', 500, 900, 120],
      ['milk', 'Milk', 'Milliliter', 'Bottle', 1000, 8000, 1500],
      ['sugar', 'Sugar', 'Gram', 'Bag', 1000, 6000, 1200],
      ['mint', 'Mint', 'Gram', 'Pack', 100, 400, 80],
      ['ginger', 'Ginger', 'Gram', 'Pack', 250, 500, 80],
      ['lemon', 'Lemon', 'Piece', 'Pack', 10, 40, 10],
      ['anise', 'Anise', 'Gram', 'Pack', 250, 450, 75],
      ['hibiscus', 'Hibiscus', 'Gram', 'Pack', 500, 700, 120],
      ['green-tea', 'Green Tea', 'Gram', 'Box', 300, 500, 80],
      ['cumin', 'Cumin', 'Gram', 'Pack', 250, 450, 75]
    ].map(([id, name, baseUnit, packageName, unitsPerPackage, currentQuantity, minimumQuantity]) => ({
      id, name, baseUnit, packageName, unitsPerPackage, currentQuantity, minimumQuantity, active: true, createdAt: nowIso()
    }));

    const drinks = [
      ['regular-coffee', 'Regular Coffee', [{ materialId: 'coffee', amount: 12 }]],
      ['coffee-milk', 'Coffee with Milk', [{ materialId: 'coffee', amount: 10 }, { materialId: 'milk', amount: 120 }]],
      ['black-nescafe', 'Black Nescafe', [{ materialId: 'nescafe', amount: 4 }]],
      ['nescafe-milk', 'Nescafe with Milk', [{ materialId: 'nescafe', amount: 4 }, { materialId: 'milk', amount: 150 }]],
      ['regular-tea', 'Regular Tea', [{ materialId: 'tea', amount: 4 }]],
      ['milk-tea', 'Milk Tea', [{ materialId: 'tea', amount: 4 }, { materialId: 'milk', amount: 150 }]],
      ['ginger-lemon', 'Ginger & Lemon', [{ materialId: 'ginger', amount: 4 }, { materialId: 'lemon', amount: .25 }]],
      ['anise-drink', 'Anise', [{ materialId: 'anise', amount: 4 }]],
      ['mint-tea', 'Mint Tea', [{ materialId: 'tea', amount: 4 }, { materialId: 'mint', amount: 2 }]],
      ['hibiscus-drink', 'Hibiscus', [{ materialId: 'hibiscus', amount: 6 }]],
      ['green-tea-drink', 'Green Tea', [{ materialId: 'green-tea', amount: 4 }]],
      ['cumin-lemon', 'Cumin & Lemon', [{ materialId: 'cumin', amount: 4 }, { materialId: 'lemon', amount: .25 }]],
      ['mint-drink', 'Mint', [{ materialId: 'mint', amount: 4 }]]
    ].map(([id, name, ingredients]) => ({ id, name, ingredients, active: true, createdAt: nowIso() }));

    return { version: 1, materials, drinks, orders: [], nextOrderNumber: 1001, updatedAt: nowIso() };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(APP_KEY);
      if (!raw) {
        const seed = defaultData();
        localStorage.setItem(APP_KEY, JSON.stringify(seed));
        return seed;
      }
      return JSON.parse(raw);
    } catch {
      const seed = defaultData();
      localStorage.setItem(APP_KEY, JSON.stringify(seed));
      return seed;
    }
  }

  let data = loadData();
  let orderUi = { selectedDrinkId: data.drinks.find(d => d.active)?.id || '', quantity: 1, sugarSpoons: 0 };
  let adminTab = 'dashboard';
  let loginRole = 'barista';
  let ingredientDraft = [{ materialId: data.materials.find(m => m.active)?.id || '', amount: 1 }];
  let editingMaterialId = null;
  let editingDrinkId = null;
  let lastNewOrderCount = data.orders.filter(o => o.status === 'New').length;

  function saveData({ broadcast = true } = {}) {
    data.updatedAt = nowIso();
    localStorage.setItem(APP_KEY, JSON.stringify(data));
    if (broadcast && channel) channel.postMessage({ type: 'data-changed', updatedAt: data.updatedAt });
  }

  function reloadData() {
    data = loadData();
  }

  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }

  function setSession(s) {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  }

  function route() {
    const hash = location.hash.replace(/^#\/?/, '').split('?')[0];
    return hash || 'order';
  }

  function go(path) {
    location.hash = `#/${path}`;
  }

  function canAccess(target) {
    const s = session();
    if (target === 'barista') return s && (s.role === 'Barista' || s.role === 'Admin');
    if (target === 'admin') return s && s.role === 'Admin';
    return true;
  }

  function topbar(active = 'order') {
    const s = session();
    return `
      <header class="topbar">
        <div class="topbar-inner">
          <button class="brand" data-go="order" aria-label="Go to ordering page">
            <span class="brand-mark">D</span>
            <span class="brand-copy"><strong>DECIMA PANTRY</strong><span>Office drinks, simplified.</span></span>
          </button>
          <div class="top-actions">
            ${s ? `<button class="nav-btn" data-go="${s.role === 'Admin' ? 'admin' : 'barista'}">${esc(s.role)}</button><button class="icon-btn" data-action="logout" title="Sign out">↪</button>` : `<button class="nav-btn ${active === 'login' ? 'primary' : ''}" data-go="login">Staff access</button><button class="icon-btn" data-go="login" title="Staff access">⚙</button>`}
          </div>
        </div>
      </header>`;
  }

  function bottomNav(active = 'order') {
    const s = session();
    const staffTarget = s ? (s.role === 'Admin' ? 'admin' : 'barista') : 'login';
    return `<nav class="bottom-nav"><button class="${active === 'order' ? 'active' : ''}" data-go="order">☕<br>Order</button><button class="${active !== 'order' ? 'active' : ''}" data-go="${staffTarget}">⚙<br>${s ? esc(s.role) : 'Staff'}</button></nav>`;
  }

  function renderOrder() {
    const employee = localStorage.getItem(EMPLOYEE_KEY) || '';
    const activeDrinks = data.drinks.filter(d => d.active);
    if (!activeDrinks.some(d => d.id === orderUi.selectedDrinkId)) orderUi.selectedDrinkId = activeDrinks[0]?.id || '';
    const selected = data.drinks.find(d => d.id === orderUi.selectedDrinkId);
    const [category, description] = descriptions[selected?.name] || ['Drink', 'Freshly prepared for your break.'];

    const drinkCards = activeDrinks.map(drink => {
      const [cat, desc] = descriptions[drink.name] || ['Drink', 'Freshly prepared for your break.'];
      return `<button class="drink-card ${drink.id === orderUi.selectedDrinkId ? 'selected' : ''}" data-drink="${esc(drink.id)}">
        <span class="check-dot">✓</span><span class="drink-icon">${icons[drink.name] || '☕'}</span>
        <span class="drink-category">${esc(cat)}</span><strong>${esc(drink.name)}</strong><small>${esc(desc)}</small>
      </button>`;
    }).join('');

    document.getElementById('app').innerHTML = `<div class="app-shell">${topbar('order')}
      <main class="page">
        <section class="hero">
          <div><span class="eyebrow light">WELCOME TO DECIMA PANTRY</span><h1>Your break.<br>Your drink.</h1><p>Choose your favorite drink, customize it, and send the order to the pantry in a few taps.</p></div>
          <div class="hero-badge">☕</div>
        </section>
        <div class="content-stack">
          <section class="card card-pad"><div class="section-head"><span class="step-num">01</span><div><h2>Who is ordering?</h2><p>Enter your name so the barista knows who the drink is for.</p></div></div>
            <div class="field"><label for="employeeName">Your name</label><input id="employeeName" class="input" autocomplete="name" maxlength="80" value="${esc(employee)}" placeholder="e.g. Radwa"></div>
          </section>
          <section class="card card-pad"><div class="section-head"><span class="step-num">02</span><div><h2>Choose your drink</h2><p>Tap one option to select it.</p></div></div>
            <div class="drink-grid">${drinkCards || `<div class="notice warn">No drinks are active. Ask an admin to add a drink recipe.</div>`}</div>
          </section>
          <section class="card card-pad"><div class="section-head"><span class="step-num">03</span><div><h2>Customize</h2><p>Choose quantity and sugar per cup.</p></div></div>
            <div class="customizer">
              <div class="custom-row"><div><strong>Quantity</strong><small>Number of cups</small></div><div class="stepper"><button data-step="quantity:-1">−</button><span>${orderUi.quantity}</span><button data-step="quantity:1">+</button></div></div>
              <div class="custom-row"><div><strong>Sugar</strong><small>Spoons per cup · <b>5 g each</b></small></div><div class="stepper"><button data-step="sugar:-1">−</button><span>${orderUi.sugarSpoons}</span><button data-step="sugar:1">+</button></div></div>
            </div>
          </section>
          <section class="summary-card">
            <div class="summary-top"><div><span class="eyebrow light">YOUR ORDER</span><h2>${esc(selected?.name || 'Choose a drink')}</h2></div><span class="summary-icon">${icons[selected?.name] || '☕'}</span></div>
            <div class="summary-pills"><span>${orderUi.quantity} ${orderUi.quantity === 1 ? 'cup' : 'cups'}</span><span>${orderUi.sugarSpoons} sugar ${orderUi.sugarSpoons === 1 ? 'spoon' : 'spoons'} / cup</span><span>${orderUi.sugarSpoons * 5} g sugar / cup</span></div>
            <button class="btn primary full" data-action="place-order" ${selected ? '' : 'disabled'}>Confirm order →</button>
          </section>
          ${renderMyOrders(employee)}
        </div>
      </main>${bottomNav('order')}</div>`;
  }

  function renderMyOrders(employee) {
    if (!employee.trim()) return '';
    const matches = data.orders.filter(o => o.employeeName.toLowerCase() === employee.trim().toLowerCase()).slice(0, 3);
    if (!matches.length) return '';
    return `<section class="card card-pad"><div class="section-head"><span class="step-num">✓</span><div><h2>Your recent orders</h2><p>Status updates from this browser.</p></div></div><div class="order-list">${matches.map(orderCardMini).join('')}</div></section>`;
  }

  function orderCardMini(o) {
    return `<div class="order-card ${o.status.toLowerCase()}"><div class="order-title"><strong>#${o.number} · ${esc(o.drinkName)}</strong><time>${timeAgo(o.createdAt)}</time></div><div class="order-meta"><span>${o.quantity} cup${o.quantity === 1 ? '' : 's'}</span><span>${o.sugarSpoons} sugar spoon${o.sugarSpoons === 1 ? '' : 's'} / cup</span><span>${esc(o.status)}</span></div></div>`;
  }

  function renderLogin() {
    const role = loginRole;
    document.getElementById('app').innerHTML = `<div class="app-shell">${topbar('login')}<main class="login-wrap"><section class="card login-card">
      <div class="login-mark">☕</div><span class="eyebrow">STAFF ACCESS</span><h1>Pantry sign in</h1><p>Baristas manage incoming orders. Admins manage orders, recipes, drinks and inventory.</p>
      <div class="role-pills"><button class="role-pill ${role === 'barista' ? 'active' : ''}" data-role="barista">Barista</button><button class="role-pill ${role === 'admin' ? 'active' : ''}" data-role="admin">Admin</button></div>
      <form id="loginForm" class="login-form">
        <div class="field"><label>Username</label><input class="input" name="username" autocomplete="username" required placeholder="${role}"></div>
        <div class="field"><label>Password</label><input class="input" name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn primary full" type="submit">Sign in as ${role === 'admin' ? 'Admin' : 'Barista'}</button>
      </form>
      <div class="notice info" style="margin-top:14px">Live Server is a static demo, so this login is a UI access gate rather than production security.</div>
      <button class="btn ghost full" data-go="order" style="margin-top:10px">← Back to ordering</button>
    </section></main>${bottomNav('login')}</div>`;
  }

  function renderBarista() {
    if (!canAccess('barista')) return go('login');
    const s = session();
    document.getElementById('app').innerHTML = `<div class="app-shell">${topbar('staff')}<main class="page">
      <section class="staff-hero"><div><span class="eyebrow light">BARISTA ACCESS</span><h1>Order queue</h1><p>Accept new orders and mark drinks complete when they are ready.</p></div><div class="staff-actions"><button class="btn ghost" data-action="test-bell">🔔 Test bell</button>${s.role === 'Admin' ? '<button class="btn ghost" data-go="admin">Admin dashboard</button>' : ''}</div></section>
      <section class="card panel" style="margin-top:16px"><div class="panel-head"><div><h2>Live orders</h2><p>New orders ring with a soft coffee-shop bell in this browser.</p></div><button class="btn soft small" data-action="refresh">Refresh</button></div>${renderOrderColumns(false)}</section>
    </main>${bottomNav('staff')}</div>`;
    checkBell();
  }

  function renderAdmin() {
    if (!canAccess('admin')) return go('login');
    const newCount = data.orders.filter(o => o.status === 'New').length;
    const preparing = data.orders.filter(o => o.status === 'Preparing').length;
    const completed = data.orders.filter(o => o.status === 'Completed').length;
    const low = data.materials.filter(m => m.active && Number(m.currentQuantity) <= Number(m.minimumQuantity)).length;
    document.getElementById('app').innerHTML = `<div class="app-shell">${topbar('staff')}<main class="page">
      <section class="staff-hero"><div><span class="eyebrow light">ADMIN ACCESS</span><h1>Pantry dashboard</h1><p>Manage orders, drinks, recipes and inventory from one place.</p></div><div class="staff-actions"><button class="btn ghost" data-action="test-bell">🔔 Test bell</button><button class="btn ghost" data-go="order">Employee order view</button></div></section>
      <div class="stats-grid"><div class="card stat"><span>NEW ORDERS</span><strong>${newCount}</strong></div><div class="card stat"><span>PREPARING</span><strong>${preparing}</strong></div><div class="card stat"><span>COMPLETED</span><strong>${completed}</strong></div><div class="card stat"><span>LOW STOCK</span><strong>${low}</strong></div></div>
      <div class="tabs"><button class="tab ${adminTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">Dashboard</button><button class="tab ${adminTab === 'orders' ? 'active' : ''}" data-tab="orders">Orders</button><button class="tab ${adminTab === 'drinks' ? 'active' : ''}" data-tab="drinks">Drinks & recipes</button><button class="tab ${adminTab === 'inventory' ? 'active' : ''}" data-tab="inventory">Inventory</button></div>
      <div id="adminPanel">${renderAdminPanel()}</div>
    </main>${bottomNav('staff')}</div>`;
    checkBell();
  }

  function renderAdminPanel() {
    if (adminTab === 'orders') return `<section class="card panel"><div class="panel-head"><div><h2>All orders</h2><p>Admin can manage the same queue as the barista.</p></div></div>${renderOrderColumns(true)}</section>`;
    if (adminTab === 'drinks') return renderDrinksPanel();
    if (adminTab === 'inventory') return renderInventoryPanel();
    const low = data.materials.filter(m => m.active && Number(m.currentQuantity) <= Number(m.minimumQuantity));
    return `<div style="display:grid;gap:14px"><section class="card panel"><div class="panel-head"><div><h2>Current queue</h2><p>Quick view of pending pantry work.</p></div><button class="btn soft small" data-tab="orders">Open full queue</button></div>${renderOrderColumns(true)}</section>
      <section class="card panel"><div class="panel-head"><div><h2>Stock alerts</h2><p>Materials at or below their minimum quantity.</p></div><button class="btn soft small" data-tab="inventory">Manage inventory</button></div>${low.length ? `<div class="table-wrap"><table><thead><tr><th>Material</th><th>Current</th><th>Minimum</th><th>Status</th></tr></thead><tbody>${low.map(m => `<tr><td><strong>${esc(m.name)}</strong></td><td>${fmt(m.currentQuantity)} ${unitShort(m.baseUnit)}</td><td>${fmt(m.minimumQuantity)} ${unitShort(m.baseUnit)}</td><td><span class="status low">Low stock</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No low-stock materials right now.</div>'}</section>
      <section class="notice warn">For a real office deployment used by multiple phones and a separate barista device, this static Live Server version will need a shared backend/database. Live Server alone cannot share browser storage between different devices.</section></div>`;
  }

  function renderOrderColumns(showCompleted) {
    const statuses = showCompleted ? ['New', 'Preparing', 'Completed'] : ['New', 'Preparing', 'Completed'];
    return `<div class="order-columns">${statuses.map(status => {
      const list = data.orders.filter(o => o.status === status).slice(0, status === 'Completed' ? 12 : 50);
      return `<div class="order-col"><div class="order-col-head"><strong>${status}</strong><span class="count-badge">${list.length}</span></div><div class="order-list">${list.length ? list.map(orderCardStaff).join('') : `<div class="empty">No ${status.toLowerCase()} orders.</div>`}</div></div>`;
    }).join('')}</div>`;
  }

  function orderCardStaff(o) {
    const actions = o.status === 'New'
      ? `<button class="btn primary small" data-order-action="accept:${o.id}">Accept</button>`
      : o.status === 'Preparing'
        ? `<button class="btn success small" data-order-action="complete:${o.id}">Complete</button>`
        : '';
    return `<article class="order-card ${o.status.toLowerCase()}"><div class="order-title"><strong>#${o.number} · ${esc(o.employeeName)}</strong><time>${timeAgo(o.createdAt)}</time></div><div class="order-drink">${icons[o.drinkName] || '☕'} ${esc(o.drinkName)}</div><div class="order-meta"><span>${o.quantity} cup${o.quantity === 1 ? '' : 's'}</span><span>${o.sugarSpoons} sugar spoon${o.sugarSpoons === 1 ? '' : 's'} / cup</span><span>${o.sugarSpoons * 5} g sugar / cup</span></div>${actions ? `<div class="order-actions">${actions}</div>` : ''}</article>`;
  }

  function renderInventoryPanel() {
    const editing = editingMaterialId ? data.materials.find(m => m.id === editingMaterialId) : null;
    return `<div style="display:grid;gap:14px"><section class="card panel"><div class="panel-head"><div><h2>${editing ? 'Edit material' : 'Add material'}</h2><p>Log coffee, tea, milk, sugar or other pantry supplies.</p></div>${editing ? '<button class="btn ghost small" data-action="cancel-material-edit">Cancel edit</button>' : ''}</div>
      <form id="materialForm" class="form-grid three">
        <input type="hidden" name="id" value="${esc(editing?.id || '')}">
        <div class="field"><label>Material name</label><input class="input" name="name" required value="${esc(editing?.name || '')}" placeholder="e.g. Coffee"></div>
        <div class="field"><label>Base unit</label><select class="select" name="baseUnit">${['Gram','Milliliter','Piece'].map(u => `<option ${editing?.baseUnit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        <div class="field"><label>Package name</label><input class="input" name="packageName" required value="${esc(editing?.packageName || 'Pack')}" placeholder="Bag, Box, Bottle"></div>
        <div class="field"><label>Units per package</label><input class="input" type="number" step="0.001" min="0.001" name="unitsPerPackage" required value="${editing?.unitsPerPackage ?? 1}"></div>
        <div class="field"><label>Current stock</label><input class="input" type="number" step="0.001" min="0" name="currentQuantity" required value="${editing?.currentQuantity ?? 0}"></div>
        <div class="field"><label>Minimum stock alert</label><input class="input" type="number" step="0.001" min="0" name="minimumQuantity" required value="${editing?.minimumQuantity ?? 0}"></div>
        <div class="field span-2"><label><input type="checkbox" name="active" ${editing ? (editing.active ? 'checked' : '') : 'checked'}> Active material</label><span class="helper">Inactive materials stay in history but cannot be used by new recipes.</span></div>
        <div style="display:flex;align-items:end"><button class="btn primary full" type="submit">${editing ? 'Save changes' : 'Add material'}</button></div>
      </form>
    </section>
    <section class="card panel"><div class="panel-head"><div><h2>Inventory</h2><p>${data.materials.length} materials logged.</p></div><button class="btn ghost small" data-action="reset-demo">Reset demo data</button></div>
      <div class="table-wrap"><table><thead><tr><th>Material</th><th>Package</th><th>Current</th><th>Minimum</th><th>Status</th><th>Actions</th></tr></thead><tbody>${data.materials.map(m => {
        const low = m.active && Number(m.currentQuantity) <= Number(m.minimumQuantity);
        return `<tr><td><strong>${esc(m.name)}</strong><div class="helper">${esc(m.baseUnit)}</div></td><td>${esc(m.packageName)} · ${fmt(m.unitsPerPackage)} ${unitShort(m.baseUnit)}</td><td>${fmt(m.currentQuantity)} ${unitShort(m.baseUnit)}</td><td>${fmt(m.minimumQuantity)} ${unitShort(m.baseUnit)}</td><td><span class="status ${!m.active ? 'off' : low ? 'low' : 'ok'}">${!m.active ? 'Inactive' : low ? 'Low stock' : 'Available'}</span></td><td><div class="row-actions"><button class="btn soft small" data-material-edit="${esc(m.id)}">Edit</button><button class="btn danger small" data-material-delete="${esc(m.id)}">Delete</button></div></td></tr>`;
      }).join('')}</tbody></table></div>
    </section></div>`;
  }

  function renderDrinksPanel() {
    const editing = editingDrinkId ? data.drinks.find(d => d.id === editingDrinkId) : null;
    if (editing && ingredientDraft.length === 1 && ingredientDraft[0].materialId === '' && editing.ingredients?.length) ingredientDraft = editing.ingredients.map(i => ({ ...i }));
    return `<div style="display:grid;gap:14px"><section class="card panel"><div class="panel-head"><div><h2>${editing ? 'Edit drink recipe' : 'Add drink'}</h2><p>Each drink can use one or more inventory materials.</p></div>${editing ? '<button class="btn ghost small" data-action="cancel-drink-edit">Cancel edit</button>' : ''}</div>
      <form id="drinkForm" class="form-grid">
        <input type="hidden" name="id" value="${esc(editing?.id || '')}">
        <div class="field"><label>Drink name</label><input class="input" name="name" required value="${esc(editing?.name || '')}" placeholder="e.g. Cappuccino"></div>
        <div class="field"><label><input type="checkbox" name="active" ${editing ? (editing.active ? 'checked' : '') : 'checked'}> Active drink</label><span class="helper">Active drinks appear on the employee ordering screen.</span></div>
        <div class="span-2"><label style="font-size:13px;font-weight:800">Recipe ingredients</label><div class="ingredient-builder" id="ingredientBuilder">${renderIngredientDraft()}</div><button type="button" class="btn soft small" data-action="add-ingredient" style="margin-top:8px">+ Add ingredient</button></div>
        <div class="span-2"><button class="btn primary" type="submit">${editing ? 'Save drink' : 'Add drink'}</button></div>
      </form>
    </section>
    <section class="card panel"><div class="panel-head"><div><h2>Drinks & recipes</h2><p>${data.drinks.filter(d => d.active).length} active drinks currently shown to employees.</p></div></div>
      <div class="recipe-grid">${data.drinks.map(d => `<article class="card recipe-card"><div class="recipe-top"><div><span class="eyebrow">${d.active ? 'ACTIVE' : 'INACTIVE'}</span><h3>${icons[d.name] || '☕'} ${esc(d.name)}</h3></div></div><div class="recipe-ingredients">${d.ingredients.map(i => {
        const m = data.materials.find(x => x.id === i.materialId); return `<div class="ingredient-line"><span>${esc(m?.name || 'Missing material')}</span><strong>${fmt(i.amount)} ${unitShort(m?.baseUnit || '')}</strong></div>`;
      }).join('')}</div><div class="row-actions"><button class="btn soft small" data-drink-edit="${esc(d.id)}">Edit</button><button class="btn danger small" data-drink-delete="${esc(d.id)}">Delete</button></div></article>`).join('')}</div>
    </section></div>`;
  }

  function renderIngredientDraft() {
    const options = data.materials.filter(m => m.active).map(m => `<option value="${esc(m.id)}">${esc(m.name)} (${unitShort(m.baseUnit)})</option>`).join('');
    return ingredientDraft.map((row, idx) => `<div class="ingredient-row"><select class="select" data-ingredient-material="${idx}">${options.replace(`value="${esc(row.materialId)}"`, `value="${esc(row.materialId)}" selected`)}</select><input class="input" type="number" min="0.001" step="0.001" value="${row.amount}" data-ingredient-amount="${idx}" aria-label="Amount"><button type="button" class="btn danger small" data-remove-ingredient="${idx}" title="Remove">×</button></div>`).join('');
  }

  function render404() { go('order'); }

  function render() {
    reloadData();
    const r = route();
    if (r === 'order') return renderOrder();
    if (r === 'login') return renderLogin();
    if (r === 'barista') return renderBarista();
    if (r === 'admin') return renderAdmin();
    return render404();
  }

  function placeOrder() {
    const nameEl = document.getElementById('employeeName');
    const employeeName = nameEl?.value.trim() || '';
    const drink = data.drinks.find(d => d.id === orderUi.selectedDrinkId && d.active);
    if (!employeeName) return toast('Please enter your name.', 'error');
    if (!drink) return toast('Please choose an available drink.', 'error');
    if (orderUi.quantity < 1 || orderUi.quantity > 10) return toast('Quantity must be between 1 and 10.', 'error');
    if (orderUi.sugarSpoons < 0 || orderUi.sugarSpoons > 10) return toast('Sugar must be between 0 and 10 spoons.', 'error');

    const requirements = new Map();
    for (const ing of drink.ingredients) requirements.set(ing.materialId, (requirements.get(ing.materialId) || 0) + Number(ing.amount) * orderUi.quantity);
    if (orderUi.sugarSpoons > 0) {
      const sugar = data.materials.find(m => m.active && m.name.toLowerCase() === 'sugar' && m.baseUnit === 'Gram');
      if (!sugar) return toast('Active Sugar inventory in grams was not found.', 'error');
      requirements.set(sugar.id, (requirements.get(sugar.id) || 0) + orderUi.sugarSpoons * 5 * orderUi.quantity);
    }

    for (const [materialId, required] of requirements) {
      const material = data.materials.find(m => m.id === materialId && m.active);
      if (!material) return toast('A recipe material is missing or inactive.', 'error');
      if (Number(material.currentQuantity) < required) return toast(`Not enough ${material.name}. Need ${fmt(required)} ${unitShort(material.baseUnit)}; available ${fmt(material.currentQuantity)} ${unitShort(material.baseUnit)}.`, 'error');
    }
    for (const [materialId, required] of requirements) {
      const material = data.materials.find(m => m.id === materialId);
      material.currentQuantity = Number(material.currentQuantity) - required;
    }

    const order = {
      id: uid('order'), number: data.nextOrderNumber++, employeeName, drinkId: drink.id, drinkName: drink.name,
      quantity: orderUi.quantity, sugarSpoons: orderUi.sugarSpoons, status: 'New', createdAt: nowIso(), acceptedAt: null, completedAt: null
    };
    data.orders.unshift(order);
    localStorage.setItem(EMPLOYEE_KEY, employeeName);
    saveData();
    if (channel) channel.postMessage({ type: 'new-order', orderId: order.id });
    orderUi.quantity = 1;
    orderUi.sugarSpoons = 0;
    toast(`Order #${order.number} sent to the pantry.`, 'success');
    renderOrder();
  }

  function updateOrder(action, id) {
    const o = data.orders.find(x => x.id === id);
    if (!o) return;
    if (action === 'accept' && o.status === 'New') { o.status = 'Preparing'; o.acceptedAt = nowIso(); toast(`Order #${o.number} accepted.`, 'success'); }
    if (action === 'complete' && o.status === 'Preparing') { o.status = 'Completed'; o.completedAt = nowIso(); toast(`Order #${o.number} completed.`, 'success'); }
    saveData();
    render();
  }

  function submitLogin(form) {
    const fd = new FormData(form);
    const expected = STAFF[loginRole];
    if (fd.get('username') === expected.username && fd.get('password') === expected.password) {
      setSession({ role: expected.role, username: expected.username, loginAt: nowIso() });
      toast(`Signed in as ${expected.role}.`, 'success');
      return go(expected.role === 'Admin' ? 'admin' : 'barista');
    }
    toast('Incorrect username or password.', 'error');
  }

  function submitMaterial(form) {
    const fd = new FormData(form);
    const id = String(fd.get('id') || '');
    const obj = {
      id: id || uid('mat'), name: String(fd.get('name') || '').trim(), baseUnit: String(fd.get('baseUnit')),
      packageName: String(fd.get('packageName') || '').trim(), unitsPerPackage: Number(fd.get('unitsPerPackage')),
      currentQuantity: Number(fd.get('currentQuantity')), minimumQuantity: Number(fd.get('minimumQuantity')),
      active: fd.get('active') === 'on', createdAt: nowIso()
    };
    if (!obj.name) return toast('Material name is required.', 'error');
    if (id) {
      const old = data.materials.find(m => m.id === id); if (!old) return;
      Object.assign(old, obj, { createdAt: old.createdAt });
      toast('Material updated.', 'success');
    } else {
      data.materials.push(obj); toast('Material added.', 'success');
    }
    editingMaterialId = null;
    saveData(); renderAdmin();
  }

  function submitDrink(form) {
    const fd = new FormData(form);
    const id = String(fd.get('id') || '');
    const name = String(fd.get('name') || '').trim();
    const ingredients = ingredientDraft.filter(i => i.materialId && Number(i.amount) > 0).map(i => ({ materialId: i.materialId, amount: Number(i.amount) }));
    if (!name) return toast('Drink name is required.', 'error');
    if (!ingredients.length) return toast('Add at least one recipe ingredient.', 'error');
    const obj = { id: id || uid('drink'), name, active: fd.get('active') === 'on', ingredients, createdAt: nowIso() };
    if (id) {
      const old = data.drinks.find(d => d.id === id); if (!old) return;
      Object.assign(old, obj, { createdAt: old.createdAt }); toast('Drink recipe updated.', 'success');
    } else { data.drinks.push(obj); toast('Drink added.', 'success'); }
    editingDrinkId = null;
    ingredientDraft = [{ materialId: data.materials.find(m => m.active)?.id || '', amount: 1 }];
    saveData(); renderAdmin();
  }

  function deleteMaterial(id) {
    const inUse = data.drinks.some(d => d.ingredients.some(i => i.materialId === id));
    if (inUse) return toast('This material is used by a drink recipe. Edit or remove that recipe first.', 'error');
    const m = data.materials.find(x => x.id === id);
    if (!m || !confirm(`Delete ${m.name}?`)) return;
    data.materials = data.materials.filter(x => x.id !== id); saveData(); renderAdmin();
  }

  function deleteDrink(id) {
    const d = data.drinks.find(x => x.id === id);
    if (!d || !confirm(`Delete ${d.name}?`)) return;
    data.drinks = data.drinks.filter(x => x.id !== id); saveData(); renderAdmin();
  }

  function resetDemo() {
    if (!confirm('Reset all orders, drinks and inventory to the default demo data?')) return;
    data = defaultData(); saveData(); editingMaterialId = null; editingDrinkId = null; ingredientDraft = [{ materialId: data.materials[0]?.id || '', amount: 1 }]; toast('Demo data reset.', 'success'); renderAdmin();
  }

  let audioCtx = null;
  function playCafeBell() {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t = audioCtx.currentTime;
      const master = audioCtx.createGain();
      master.gain.setValueAtTime(0.0001, t);
      master.gain.exponentialRampToValueAtTime(0.16, t + 0.012);
      master.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
      master.connect(audioCtx.destination);
      [659.25, 987.77, 1318.51].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime([0.52, 0.25, 0.10][idx], t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.05 + idx * .12);
        osc.connect(gain); gain.connect(master); osc.start(t + idx * .008); osc.stop(t + 1.5);
      });
    } catch { /* Audio is optional. */ }
  }

  function checkBell() {
    const count = data.orders.filter(o => o.status === 'New').length;
    if (count > lastNewOrderCount) playCafeBell();
    lastNewOrderCount = count;
  }

  function timeAgo(iso) {
    const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60); if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60); if (hr < 24) return `${hr}h ago`;
    return new Date(iso).toLocaleDateString();
  }

  function toast(message, type = '') {
    const host = document.getElementById('toastHost');
    const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; host.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  document.addEventListener('click', event => {
    const goEl = event.target.closest('[data-go]'); if (goEl) return go(goEl.dataset.go);
    const drinkEl = event.target.closest('[data-drink]'); if (drinkEl) { orderUi.selectedDrinkId = drinkEl.dataset.drink; return renderOrder(); }
    const stepEl = event.target.closest('[data-step]'); if (stepEl) {
      const [kind, raw] = stepEl.dataset.step.split(':'); const delta = Number(raw);
      if (kind === 'quantity') orderUi.quantity = Math.min(10, Math.max(1, orderUi.quantity + delta));
      if (kind === 'sugar') orderUi.sugarSpoons = Math.min(10, Math.max(0, orderUi.sugarSpoons + delta));
      const name = document.getElementById('employeeName')?.value || ''; if (name) localStorage.setItem(EMPLOYEE_KEY, name); return renderOrder();
    }
    const actionEl = event.target.closest('[data-action]'); if (actionEl) {
      const action = actionEl.dataset.action;
      if (action === 'place-order') return placeOrder();
      if (action === 'logout') { setSession(null); toast('Signed out.'); return go('order'); }
      if (action === 'test-bell') return playCafeBell();
      if (action === 'refresh') return render();
      if (action === 'reset-demo') return resetDemo();
      if (action === 'add-ingredient') { ingredientDraft.push({ materialId: data.materials.find(m => m.active)?.id || '', amount: 1 }); return renderAdmin(); }
      if (action === 'cancel-material-edit') { editingMaterialId = null; return renderAdmin(); }
      if (action === 'cancel-drink-edit') { editingDrinkId = null; ingredientDraft = [{ materialId: data.materials.find(m => m.active)?.id || '', amount: 1 }]; return renderAdmin(); }
    }
    const roleEl = event.target.closest('[data-role]'); if (roleEl) { loginRole = roleEl.dataset.role; return renderLogin(); }
    const tabEl = event.target.closest('[data-tab]'); if (tabEl) { adminTab = tabEl.dataset.tab; return renderAdmin(); }
    const orderEl = event.target.closest('[data-order-action]'); if (orderEl) { const [action, id] = orderEl.dataset.orderAction.split(':'); return updateOrder(action, id); }
    const materialEdit = event.target.closest('[data-material-edit]'); if (materialEdit) { editingMaterialId = materialEdit.dataset.materialEdit; return renderAdmin(); }
    const materialDelete = event.target.closest('[data-material-delete]'); if (materialDelete) return deleteMaterial(materialDelete.dataset.materialDelete);
    const drinkEdit = event.target.closest('[data-drink-edit]'); if (drinkEdit) { editingDrinkId = drinkEdit.dataset.drinkEdit; const d = data.drinks.find(x => x.id === editingDrinkId); ingredientDraft = d?.ingredients.map(i => ({...i})) || []; return renderAdmin(); }
    const drinkDelete = event.target.closest('[data-drink-delete]'); if (drinkDelete) return deleteDrink(drinkDelete.dataset.drinkDelete);
    const removeIng = event.target.closest('[data-remove-ingredient]'); if (removeIng) { const idx = Number(removeIng.dataset.removeIngredient); ingredientDraft.splice(idx, 1); if (!ingredientDraft.length) ingredientDraft.push({ materialId: data.materials.find(m => m.active)?.id || '', amount: 1 }); return renderAdmin(); }
  });

  document.addEventListener('change', event => {
    if (event.target.matches('[data-ingredient-material]')) { ingredientDraft[Number(event.target.dataset.ingredientMaterial)].materialId = event.target.value; }
    if (event.target.matches('[data-ingredient-amount]')) { ingredientDraft[Number(event.target.dataset.ingredientAmount)].amount = Number(event.target.value); }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'employeeName') localStorage.setItem(EMPLOYEE_KEY, event.target.value);
  });

  document.addEventListener('submit', event => {
    if (event.target.id === 'loginForm') { event.preventDefault(); return submitLogin(event.target); }
    if (event.target.id === 'materialForm') { event.preventDefault(); return submitMaterial(event.target); }
    if (event.target.id === 'drinkForm') { event.preventDefault(); return submitDrink(event.target); }
  });

  window.addEventListener('hashchange', render);
  window.addEventListener('storage', event => { if (event.key === APP_KEY) { reloadData(); render(); checkBell(); } });
  channel?.addEventListener('message', ev => { if (ev.data?.type === 'data-changed' || ev.data?.type === 'new-order') { reloadData(); render(); checkBell(); } });

  if (!location.hash) history.replaceState(null, '', '#/order');
  render();
})();
