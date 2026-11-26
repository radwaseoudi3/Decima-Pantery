(() => {
  'use strict';

  const APP_KEY = 'decimaPantryLiveServerV1'; // keep the existing key so browser-added pantry data is preserved
  const SESSION_KEY = 'decimaPantryStaffSession';
  const MY_ORDER_IDS_KEY = 'decimaPantryMyOrderIds';
  const START_KEY = 'decimaPantryStartedThisTab';
  const CUSTOM_DRINK_ID = '__custom__';
  const CUSTOM_LOCATION_ID = '__custom_location__';
  const SUGAR_GRAMS_PER_SPOON = 5;
  const CLOUD = window.DECIMA_PANTRY_CLOUD || { enabled: false };
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('decima-pantry-live') : null;

  const LOCAL_STAFF = {
    barista: { username: 'barista', password: 'Coffee123!', role: 'Barista' },
    admin: { username: 'admin', password: 'Decima123!', role: 'Admin' }
  };

  const DRINK_TRANSLATIONS = {
    'Regular Coffee': 'قهوة عادية',
    'Coffee with Milk': 'قهوة بالحليب',
    'Black Nescafe': 'نسكافيه سادة',
    'Nescafe with Milk': 'نسكافيه بالحليب',
    'Regular Tea': 'شاي عادي',
    'Milk Tea': 'شاي بالحليب',
    'Ginger & Lemon': 'زنجبيل بالليمون',
    'Anise': 'يانسون',
    'Mint Tea': 'شاي بالنعناع',
    'Hibiscus': 'كركديه',
    'Green Tea': 'شاي أخضر',
    'Cumin & Lemon': 'كمون بالليمون',
    'Mint': 'نعناع'
  };

  const MATERIAL_TRANSLATIONS = {
    Coffee: 'قهوة', Nescafe: 'نسكافيه', Tea: 'شاي', Milk: 'حليب', Sugar: 'سكر', Mint: 'نعناع',
    Ginger: 'زنجبيل', Lemon: 'ليمون', Anise: 'يانسون', Hibiscus: 'كركديه', 'Green Tea': 'شاي أخضر', Cumin: 'كمون'
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

  const MAIN_HALL_PODS = [
    ['A', ['A1', 'A2', 'A3', 'A4']],
    ['B', ['B1', 'B2', 'B3', 'B4']],
    ['C', ['C1', 'C2', 'C3', 'C4']],
    ['D', ['D1', 'D2', 'D3', 'D4']],
    ['E', ['E1', 'E2', 'E3', 'E4']]
  ];

  const nowIso = () => new Date().toISOString();
  const uid = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fmt = n => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  const unitShort = unit => ({ Gram: 'g', Milliliter: 'ml', Piece: 'pc' }[unit] || unit);
  const cloudEnabled = () => Boolean(CLOUD.enabled && CLOUD.supabaseUrl && CLOUD.anonKey && !String(CLOUD.supabaseUrl).includes('YOUR-PROJECT') && !String(CLOUD.anonKey).includes('YOUR-SUPABASE'));
  const hostedProduction = () => location.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname);

  function defaultLocations() {
    return [
      ['finance-room', 'Finance Room', 'غرفة المالية', false],
      ['balcony', 'Balcony', 'البلكونة', false],
      ['amira-office', "Amira's Office", 'مكتب أميرة', false],
      ['mazen-office', "Mazen's Office", 'مكتب مازن', false],
      ['engineers-office', "Engineers' Office", 'مكتب المهندسين', false],
      ['operations-office', 'Operations Team Office', 'مكتب فريق العمليات', false],
      ['main-hall', 'Main Hall', 'القاعة الرئيسية', true],
      ['sara-office', "Sara's Office", 'مكتب سارة', false],
      ['ahmed-tawfik-office', "Ahmed Tawfik's Office", 'مكتب أحمد توفيق', false],
      ['reception', 'Reception', 'الاستقبال', false]
    ].map(([id, nameEn, nameAr, hasDeskMap], sortOrder) => ({ id, nameEn, nameAr, hasDeskMap, active: true, sortOrder, createdAt: nowIso() }));
  }

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
    ].map(([id, nameEn, baseUnit, packageName, unitsPerPackage, currentQuantity, minimumQuantity]) => ({
      id, nameEn, nameAr: MATERIAL_TRANSLATIONS[nameEn] || nameEn, baseUnit, packageName, unitsPerPackage,
      currentQuantity, minimumQuantity, active: true, createdAt: nowIso()
    }));

    // Ginger & Lemon is intentionally ONE drink/recipe.
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
    ].map(([id, nameEn, ingredients]) => {
      const [category, description] = descriptions[nameEn] || ['Drink', 'Freshly prepared.'];
      return { id, nameEn, nameAr: DRINK_TRANSLATIONS[nameEn] || nameEn, icon: icons[nameEn] || '☕', category, description, ingredients, active: true, createdAt: nowIso() };
    });

    return { version: 3, materials, drinks, locations: defaultLocations(), orders: [], nextOrderNumber: 1001, updatedAt: nowIso() };
  }

  function normalizeData(raw) {
    const fallback = defaultData();
    const d = raw && typeof raw === 'object' ? raw : fallback;
    d.materials = Array.isArray(d.materials) ? d.materials.map(m => ({
      ...m,
      nameEn: m.nameEn || m.name || 'Material',
      nameAr: m.nameAr || MATERIAL_TRANSLATIONS[m.nameEn || m.name] || m.nameEn || m.name || 'مكوّن',
      active: m.active !== false
    })) : fallback.materials;
    d.drinks = Array.isArray(d.drinks) ? d.drinks.map(dr => {
      const nameEn = dr.nameEn || dr.name || 'Drink';
      const [cat, desc] = descriptions[nameEn] || ['Drink', 'Freshly prepared for your break.'];
      return {
        ...dr,
        nameEn,
        nameAr: dr.nameAr || DRINK_TRANSLATIONS[nameEn] || nameEn,
        icon: dr.icon || icons[nameEn] || '☕',
        category: dr.category || cat,
        description: dr.description || desc,
        ingredients: Array.isArray(dr.ingredients) ? dr.ingredients : [],
        active: dr.active !== false
      };
    }) : fallback.drinks;
    d.locations = Array.isArray(d.locations) && d.locations.length ? d.locations.map((l, i) => ({
      ...l,
      nameEn: l.nameEn || l.name || `Location ${i + 1}`,
      nameAr: l.nameAr || l.nameEn || l.name || `الموقع ${i + 1}`,
      hasDeskMap: Boolean(l.hasDeskMap),
      active: l.active !== false,
      sortOrder: Number.isFinite(Number(l.sortOrder)) ? Number(l.sortOrder) : i
    })) : fallback.locations;
    d.orders = Array.isArray(d.orders) ? d.orders.map(o => ({
      ...o,
      drinkNameEn: o.drinkNameEn || o.drinkName || 'Drink',
      drinkNameAr: o.drinkNameAr || DRINK_TRANSLATIONS[o.drinkNameEn || o.drinkName] || o.drinkNameEn || o.drinkName || 'مشروب',
      locationNameEn: o.locationNameEn || (o.employeeName ? `Legacy order · ${o.employeeName}` : 'Unknown location'),
      locationNameAr: o.locationNameAr || (o.employeeName ? `طلب قديم · ${o.employeeName}` : 'موقع غير محدد'),
      deskId: o.deskId || '',
      customRequest: o.customRequest || '',
      status: o.status || 'New'
    })) : [];
    d.nextOrderNumber = Number(d.nextOrderNumber || 1001);
    d.version = 3;
    d.updatedAt = d.updatedAt || nowIso();
    return d;
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(APP_KEY);
      const d = raw ? normalizeData(JSON.parse(raw)) : defaultData();
      localStorage.setItem(APP_KEY, JSON.stringify(d));
      return d;
    } catch {
      const d = defaultData();
      localStorage.setItem(APP_KEY, JSON.stringify(d));
      return d;
    }
  }

  let data = loadData();
  // Snapshot the browser data BEFORE any cloud sync so the Admin can migrate old ingredients/drinks that existed in localStorage.
  const preCloudLocalSnapshot = JSON.parse(JSON.stringify(data));
  let orderUi = { selectedDrinkId: '', locationId: '', deskId: '', customLocation: '', quantity: 1, sugarSpoons: 0, customRequest: '' };
  let adminTab = 'dashboard';
  let loginRole = 'barista';
  let ingredientDraft = [{ materialId: data.materials.find(m => m.active)?.id || '', amount: 1 }];
  let editingMaterialId = null;
  let editingDrinkId = null;
  let editingLocationId = null;
  let cloudBusy = false;
  let pollTimer = null;
  let catalogTimer = null;

  function saveCache({ broadcast = true } = {}) {
    data.updatedAt = nowIso();
    localStorage.setItem(APP_KEY, JSON.stringify(data));
    if (broadcast && channel) channel.postMessage({ type: 'data-changed', updatedAt: data.updatedAt });
  }

  function reloadCache() { data = loadData(); }

  function session() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function setSession(s) {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    if (!s) return;
    // Keep the dedicated Barista phone signed in across mobile reloads/restarts.
    // Admin sessions remain tab-scoped.
    const store = s.role === 'Barista' ? localStorage : sessionStorage;
    store.setItem(SESSION_KEY, JSON.stringify(s));
  }

  function route() {
    const hash = location.hash.replace(/^#\/?/, '').split('?')[0];
    return hash || 'order';
  }

  function go(path) { location.hash = `#/${path}`; }

  function canAccess(target) {
    const s = session();
    if (target === 'barista') return s && (s.role === 'Barista' || s.role === 'Admin');
    if (target === 'admin') return s && s.role === 'Admin';
    return true;
  }

  function topbar(active = 'order', arabic = false) {
    const s = session();
    const staffLabel = arabic ? 'دخول الموظفين' : 'Staff access';
    const roleLabel = s?.role === 'Barista' && arabic ? 'الباريستا' : s?.role;
    return `<header class="topbar"><div class="topbar-inner">
      <button class="brand" data-go="order" aria-label="Go to ordering page"><span class="brand-mark">D</span><span class="brand-copy"><strong>DECIMA PANTRY</strong><span>Office drinks, simplified.</span></span></button>
      <div class="top-actions">${s ? `<button class="nav-btn" data-go="${s.role === 'Admin' ? 'admin' : 'barista'}">${esc(roleLabel)}</button><button class="icon-btn" data-action="logout" title="Sign out">↪</button>` : `<button class="nav-btn ${active === 'login' ? 'primary' : ''}" data-go="login">${staffLabel}</button><button class="icon-btn" data-go="login" title="${staffLabel}">⚙</button>`}</div>
    </div></header>`;
  }

  function bottomNav(active = 'order', arabic = false) {
    const s = session();
    const staffTarget = s ? (s.role === 'Admin' ? 'admin' : 'barista') : 'login';
    const orderLabel = arabic ? 'الطلب' : 'Order';
    const staffLabel = arabic ? (s?.role === 'Barista' ? 'الباريستا' : 'الموظفون') : (s ? s.role : 'Staff');
    return `<nav class="bottom-nav"><button class="${active === 'order' ? 'active' : ''}" data-go="order">☕<br>${orderLabel}</button><button class="${active !== 'order' ? 'active' : ''}" data-go="${staffTarget}">⚙<br>${esc(staffLabel)}</button></nav>`;
  }

  function selectedDrink() {
    if (orderUi.selectedDrinkId === CUSTOM_DRINK_ID) return { id: CUSTOM_DRINK_ID, nameEn: 'Custom Request', nameAr: 'طلب خاص', icon: '✍️', category: 'Special', description: 'Type exactly what you need.', ingredients: [], active: true };
    return data.drinks.find(d => d.id === orderUi.selectedDrinkId && d.active) || null;
  }

  function selectedLocation() {
    if (orderUi.locationId === CUSTOM_LOCATION_ID) return { id: CUSTOM_LOCATION_ID, nameEn: orderUi.customLocation.trim() || 'Custom Location', nameAr: orderUi.customLocation.trim() ? `موقع مخصص: ${orderUi.customLocation.trim()}` : 'موقع مخصص', hasDeskMap: false, active: true };
    return data.locations.find(l => l.id === orderUi.locationId && l.active) || null;
  }

  function renderOrder() {
    const activeDrinks = data.drinks.filter(d => d.active);
    const activeLocations = data.locations.filter(l => l.active).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    const drink = selectedDrink();
    const loc = selectedLocation();

    const drinkCards = activeDrinks.map(d => `<button class="drink-card ${d.id === orderUi.selectedDrinkId ? 'selected' : ''}" data-drink="${esc(d.id)}">
      <span class="check-dot">✓</span><span class="drink-icon">${esc(d.icon || icons[d.nameEn] || '☕')}</span>
      <span class="drink-category">${esc(d.category || 'Drink')}</span><strong>${esc(d.nameEn)}</strong><small>${esc(d.description || 'Freshly prepared for your break.')}</small>
    </button>`).join('');

    const customCard = `<button class="drink-card custom-request-card ${orderUi.selectedDrinkId === CUSTOM_DRINK_ID ? 'selected' : ''}" data-drink="${CUSTOM_DRINK_ID}">
      <span class="check-dot">✓</span><span class="drink-icon">✍️</span><span class="drink-category">SPECIAL</span><strong>Custom Request</strong><small>Type a drink or pantry request that is not listed.</small>
    </button>`;

    const locationCards = activeLocations.map(l => `<button class="location-card ${l.id === orderUi.locationId ? 'selected' : ''}" data-location="${esc(l.id)}">
      <span class="location-icon">${l.hasDeskMap ? '🪑' : l.id === 'reception' ? '🛎️' : l.id === 'balcony' ? '🌤️' : '📍'}</span><strong>${esc(l.nameEn)}</strong>${l.hasDeskMap ? '<small>Choose your desk after selecting</small>' : '<small>Deliver here</small>'}<span class="location-check">✓</span>
    </button>`).join('') + `<button class="location-card custom-location-card ${orderUi.locationId === CUSTOM_LOCATION_ID ? 'selected' : ''}" data-location="${CUSTOM_LOCATION_ID}">
      <span class="location-icon">✍️</span><strong>Custom Location</strong><small>Type another delivery location</small><span class="location-check">✓</span>
    </button>`;

    document.getElementById('app').innerHTML = `<div class="app-shell">${topbar('order')}
      <main class="page">
        <section class="hero"><div><span class="eyebrow light">WELCOME TO DECIMA PANTRY</span><h1>Pick. Place.<br>Enjoy.</h1><p>Choose your drink first, tell the pantry where to bring it, customize it, and submit.</p></div><div class="hero-badge">☕</div></section>
        <div class="content-stack order-flow">
          <section class="card card-pad" id="drinkStep"><div class="section-head"><span class="step-num">01</span><div><h2>Choose your drink</h2><p>Tap one option to continue.</p></div></div><div class="drink-grid">${drinkCards}${customCard}</div></section>

          <section class="card card-pad ${drink ? '' : 'step-muted'}" id="locationStep"><div class="section-head"><span class="step-num">02</span><div><h2>Where should we bring it?</h2><p>Choose your office or desk location.</p></div></div>
            <div class="location-grid">${locationCards}</div>
            ${orderUi.locationId === CUSTOM_LOCATION_ID ? `<div class="custom-location-entry"><label for="customLocation">Type your location</label><input id="customLocation" class="input" maxlength="120" placeholder="e.g. Meeting room beside Finance" value="${esc(orderUi.customLocation)}"><span class="helper">The Barista will see this as a custom delivery location.</span></div>` : ''}
            ${loc?.hasDeskMap ? renderDeskMap() : ''}
          </section>

          <section class="card card-pad ${(drink && loc && (!loc.hasDeskMap || orderUi.deskId)) ? '' : 'step-muted'}" id="customStep"><div class="section-head"><span class="step-num">03</span><div><h2>${drink?.id === CUSTOM_DRINK_ID ? 'Describe your request' : 'Customize your drink'}</h2><p>${drink?.id === CUSTOM_DRINK_ID ? 'Tell the barista exactly what you need.' : `Choose quantity and sugar. Each sugar spoon is ${SUGAR_GRAMS_PER_SPOON} g.`}</p></div></div>
            <div class="customizer">
              <div class="custom-row"><div><strong>Quantity</strong><small>Number of cups/items</small></div><div class="stepper"><button data-step="quantity:-1">−</button><span>${orderUi.quantity}</span><button data-step="quantity:1">+</button></div></div>
              ${drink?.id === CUSTOM_DRINK_ID ? '' : `<div class="custom-row"><div><strong>Sugar</strong><small>Spoons per cup · <b>${SUGAR_GRAMS_PER_SPOON} g each</b></small></div><div class="stepper"><button data-step="sugar:-1">−</button><span>${orderUi.sugarSpoons}</span><button data-step="sugar:1">+</button></div></div>`}
            </div>
            <div class="field request-field"><label for="customRequest">${drink?.id === CUSTOM_DRINK_ID ? 'Custom request' : 'Special request (optional)'}</label><textarea id="customRequest" class="input textarea" maxlength="300" placeholder="${drink?.id === CUSTOM_DRINK_ID ? 'e.g. Hot water with two lemon slices' : 'e.g. Less milk, very hot, no foam'}">${esc(orderUi.customRequest)}</textarea><span class="helper">This note will appear clearly on the Barista order card.</span></div>
          </section>

          <section class="summary-card ${drink && loc && (!loc.hasDeskMap || orderUi.deskId) ? '' : 'summary-disabled'}">
            <div class="summary-top"><div><span class="eyebrow light">YOUR ORDER</span><h2>${esc(drink?.nameEn || 'Choose a drink')}</h2></div><span class="summary-icon">${esc(drink?.icon || '☕')}</span></div>
            <div class="summary-pills"><span>📍 ${esc(orderUi.locationId === CUSTOM_LOCATION_ID ? (orderUi.customLocation || 'Custom Location') : (loc?.nameEn || 'Choose location'))}${orderUi.deskId ? ` · Desk ${esc(orderUi.deskId)}` : ''}</span><span>${orderUi.quantity} ${orderUi.quantity === 1 ? 'cup/item' : 'cups/items'}</span>${drink?.id === CUSTOM_DRINK_ID ? '<span>Custom request</span>' : `<span>${orderUi.sugarSpoons} sugar ${orderUi.sugarSpoons === 1 ? 'spoon' : 'spoons'} / cup</span><span>${orderUi.sugarSpoons * SUGAR_GRAMS_PER_SPOON} g sugar / cup</span>`}</div>
            ${orderUi.customRequest.trim() ? `<div class="summary-note">✍️ ${esc(orderUi.customRequest.trim())}</div>` : ''}
            <button class="btn primary full" data-action="place-order" ${drink && loc && (!loc.hasDeskMap || orderUi.deskId) ? '' : 'disabled'}>Submit order →</button>
          </section>
          ${cloudEnabled() ? '' : '<div class="notice info local-note">Testing mode: this browser is using local storage. Connect the shared database before office-wide use so phones and the Barista device share the same orders.</div>'}
        </div>
      </main>${bottomNav('order')}</div>`;
  }

  function renderDeskMap() {
    const pods = MAIN_HALL_PODS.map(([pod, seats]) => `<div class="desk-pod"><div class="desk-pod-label">Desk cluster ${pod}</div><div class="desk-seat-row desk-seat-row-top">${seats.slice(0, 2).map(s => deskSeat(s, 'top')).join('')}</div><div class="desk-table-shape"><span>WORKSTATION</span><small>Desk cluster ${pod}</small></div><div class="desk-seat-row desk-seat-row-bottom">${seats.slice(2).map(s => deskSeat(s, 'bottom')).join('')}</div></div>`).join('');
    return `<div class="main-hall-map"><div class="map-head"><div><span class="eyebrow">MAIN HALL</span><h3>Select your exact workstation</h3><p>Tap the chair number that matches where you are sitting.</p></div><div class="map-legend"><span><i></i> Available chair</span><span class="selected-legend"><i></i> Selected</span></div></div><div class="desk-pod-grid">${pods}</div></div>`;
  }

  function deskSeat(id, side = 'top') {
    return `<button class="desk-seat desk-seat-${side} ${orderUi.deskId === id ? 'selected' : ''}" data-desk="${id}" aria-label="Workstation chair ${id}"><span class="chair-visual" aria-hidden="true"><i class="chair-back"></i><i class="chair-seat-cushion"></i><i class="chair-base"></i></span><strong>${id}</strong><span class="desk-seat-hint">Tap</span></button>`;
  }

  function renderLogin() {
    const isBarista = loginRole === 'barista';
    document.getElementById('app').innerHTML = `<div class="app-shell">${topbar('login')}<main class="login-wrap"><section class="card login-card ${isBarista ? 'rtl-login' : ''}" ${isBarista ? 'dir="rtl" lang="ar"' : ''}>
      <div class="login-mark">☕</div><span class="eyebrow">${isBarista ? 'دخول الموظفين' : 'STAFF ACCESS'}</span><h1>${isBarista ? 'دخول الباريستا' : 'Pantry sign in'}</h1><p>${isBarista ? 'استلم الطلبات الجديدة وابدأ التحضير من شاشة الباريستا.' : 'Admins manage orders, drinks, recipes, ingredients, inventory and locations.'}</p>
      <div class="role-pills"><button class="role-pill ${isBarista ? 'active' : ''}" data-role="barista">باريستا</button><button class="role-pill ${!isBarista ? 'active' : ''}" data-role="admin">Admin</button></div>
      <form id="loginForm" class="login-form">
        <div class="field"><label>${isBarista ? 'اسم المستخدم' : 'Username'}</label><input class="input" name="username" autocomplete="username" required placeholder="${isBarista ? 'barista' : 'admin'}" value="${isBarista ? 'barista' : 'admin'}"></div>
        <div class="field"><label>${isBarista ? 'كلمة المرور' : 'Password'}</label><input class="input" name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn primary full" type="submit">${isBarista ? 'دخول الباريستا' : 'Sign in as Admin'}</button>
      </form>
      <div class="notice info" style="margin-top:14px">${cloudEnabled() ? (isBarista ? 'الدخول متصل بقاعدة البيانات المشتركة.' : 'Shared database authentication is enabled.') : (isBarista ? 'وضع تجريبي محلي.' : 'Local demo login is active until the shared database is configured.')}</div>
      <button class="btn ghost full" data-go="order" style="margin-top:10px">${isBarista ? 'العودة لصفحة الطلب ←' : '← Back to ordering'}</button>
    </section></main>${bottomNav('login', isBarista)}</div>`;
  }

  function renderBarista() {
    if (!canAccess('barista')) return go('login');
    const s = session();
    document.getElementById('app').innerHTML = `<div class="app-shell barista-shell" dir="rtl" lang="ar">${topbar('staff', true)}<main class="page">
      <section class="staff-hero"><div><span class="eyebrow light">شاشة الباريستا</span><h1>طلبات المشروبات</h1><p>استلم الطلب الجديد ليقف الجرس، ثم علّم الطلب كمكتمل بعد التحضير.</p></div><div class="staff-actions"><button class="btn ghost" data-action="enable-bell">🔔 تفعيل / تجربة الجرس</button>${s.role === 'Admin' ? '<button class="btn ghost" data-go="admin">لوحة الإدارة</button>' : ''}</div></section>
      <section class="bell-status ${bellEnabled ? 'enabled' : ''} ${cloudEnabled() ? 'shared-online' : 'shared-offline'}"><span class="bell-dot"></span><strong>${bellEnabled ? 'جرس الطلبات مفعّل' : 'اضغط “تفعيل الجرس” مرة واحدة للسماح بالصوت في هذا المتصفح'}</strong><span>${cloudEnabled() ? 'متصل بالطلبات المشتركة — طلبات الهواتف ستظهر هنا تلقائياً' : '⚠ قاعدة البيانات المشتركة غير متصلة — الطلبات من الهواتف الأخرى لن تصل إلى هذا الجهاز'}</span></section>
      <section class="card panel" style="margin-top:16px"><div class="panel-head"><div><h2>الطلبات المباشرة</h2><p>يستمر جرس المقهى في الرنين ما دام هناك طلب جديد لم يتم استلامه.</p></div><button class="btn soft small" data-action="refresh">تحديث</button></div>${renderOrderColumns(true)}</section>
    </main>${bottomNav('staff', true)}</div>`;
    updateBellLoop();
  }

  function renderAdmin() {
    if (!canAccess('admin')) return go('login');
    const newCount = data.orders.filter(o => o.status === 'New').length;
    const preparing = data.orders.filter(o => o.status === 'Preparing').length;
    const completed = data.orders.filter(o => o.status === 'Completed').length;
    const low = data.materials.filter(m => m.active && Number(m.currentQuantity) <= Number(m.minimumQuantity)).length;
    document.getElementById('app').innerHTML = `<div class="app-shell">${topbar('staff')}<main class="page">
      <section class="staff-hero"><div><span class="eyebrow light">ADMIN ACCESS</span><h1>Pantry dashboard</h1><p>Manage shared orders, bilingual drinks, recipes, ingredients, inventory and delivery locations.</p></div><div class="staff-actions"><button class="btn ghost" data-go="barista">Barista view</button><button class="btn ghost" data-go="order">Employee order view</button></div></section>
      <div class="stats-grid"><div class="card stat"><span>NEW ORDERS</span><strong>${newCount}</strong></div><div class="card stat"><span>PREPARING</span><strong>${preparing}</strong></div><div class="card stat"><span>COMPLETED</span><strong>${completed}</strong></div><div class="card stat"><span>LOW STOCK</span><strong>${low}</strong></div></div>
      <div class="tabs"><button class="tab ${adminTab === 'dashboard' ? 'active' : ''}" data-tab="dashboard">Dashboard</button><button class="tab ${adminTab === 'orders' ? 'active' : ''}" data-tab="orders">Orders</button><button class="tab ${adminTab === 'drinks' ? 'active' : ''}" data-tab="drinks">Drinks & recipes</button><button class="tab ${adminTab === 'inventory' ? 'active' : ''}" data-tab="inventory">Ingredients & inventory</button><button class="tab ${adminTab === 'locations' ? 'active' : ''}" data-tab="locations">Locations</button><button class="tab ${adminTab === 'cloud' ? 'active' : ''}" data-tab="cloud">Shared database</button></div>
      <div id="adminPanel">${renderAdminPanel()}</div>
    </main>${bottomNav('staff')}</div>`;
  }

  function renderAdminPanel() {
    if (adminTab === 'orders') return `<section class="card panel"><div class="panel-head"><div><h2>All orders</h2><p>Admin can manage the same queue as the Barista.</p></div></div>${renderOrderColumns(false)}</section>`;
    if (adminTab === 'drinks') return renderDrinksPanel();
    if (adminTab === 'inventory') return renderInventoryPanel();
    if (adminTab === 'locations') return renderLocationsPanel();
    if (adminTab === 'cloud') return renderCloudPanel();
    const low = data.materials.filter(m => m.active && Number(m.currentQuantity) <= Number(m.minimumQuantity));
    return `<div style="display:grid;gap:14px"><section class="card panel"><div class="panel-head"><div><h2>Current queue</h2><p>Quick view of pending pantry work.</p></div><button class="btn soft small" data-tab="orders">Open full queue</button></div>${renderOrderColumns(false)}</section>
      <section class="card panel"><div class="panel-head"><div><h2>Stock alerts</h2><p>Ingredients at or below their minimum quantity.</p></div><button class="btn soft small" data-tab="inventory">Manage inventory</button></div>${low.length ? `<div class="table-wrap"><table><thead><tr><th>Ingredient</th><th>Current</th><th>Minimum</th><th>Status</th></tr></thead><tbody>${low.map(m => `<tr><td><strong>${esc(m.nameEn)}</strong></td><td>${fmt(m.currentQuantity)} ${unitShort(m.baseUnit)}</td><td>${fmt(m.minimumQuantity)} ${unitShort(m.baseUnit)}</td><td><span class="status low">Low stock</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No low-stock ingredients right now.</div>'}</section>
      <section class="notice ${cloudEnabled() ? 'success-note' : 'warn'}"><strong>${cloudEnabled() ? 'Shared database mode is enabled.' : 'Shared database is not connected yet.'}</strong><br>${cloudEnabled() ? 'Orders can sync between employee phones and the Barista device.' : 'The app still works locally, but cross-device orders require the one-time Supabase setup included in this folder.'}</section></div>`;
  }

  function renderOrderColumns(arabic = false) {
    const statusLabels = arabic ? { New: 'طلبات جديدة', Preparing: 'قيد التحضير', Completed: 'مكتملة' } : { New: 'New', Preparing: 'Preparing', Completed: 'Completed' };
    return `<div class="order-columns">${['New', 'Preparing', 'Completed'].map(status => {
      const list = data.orders.filter(o => o.status === status).slice(0, status === 'Completed' ? 18 : 60);
      return `<div class="order-col"><div class="order-col-head"><strong>${statusLabels[status]}</strong><span class="count-badge">${list.length}</span></div><div class="order-list">${list.length ? list.map(o => orderCardStaff(o, arabic)).join('') : `<div class="empty">${arabic ? 'لا توجد طلبات هنا.' : `No ${status.toLowerCase()} orders.`}</div>`}</div></div>`;
    }).join('')}</div>`;
  }

  function renderStaffDeskMap(deskId, arabic = false) {
    if (!deskId) return '';
    const pods = MAIN_HALL_PODS.map(([pod, seats]) => `<div class="staff-desk-pod"><div class="staff-desk-pod-label">${arabic ? `مجموعة ${esc(pod)}` : `Cluster ${esc(pod)}`}</div><div class="staff-desk-row">${seats.slice(0, 2).map(id => `<span class="staff-desk-seat ${id === deskId ? 'selected' : ''}"><i></i>${esc(id)}</span>`).join('')}</div><div class="staff-desk-table"></div><div class="staff-desk-row">${seats.slice(2).map(id => `<span class="staff-desk-seat ${id === deskId ? 'selected' : ''}"><i></i>${esc(id)}</span>`).join('')}</div></div>`).join('');
    return `<div class="staff-main-hall-map"><div class="staff-map-title"><strong>${arabic ? 'مكان الطلب داخل القاعة الرئيسية' : 'Main Hall desk location'}</strong><span>${arabic ? `المكتب المحدد: ${esc(deskId)}` : `Selected desk: ${esc(deskId)}`}</span></div><div class="staff-desk-grid">${pods}</div></div>`;
  }

  function orderCardStaff(o, arabic) {
    const drinkName = arabic ? (o.drinkNameAr || o.drinkNameEn) : (o.drinkNameEn || o.drinkNameAr);
    const locationName = arabic ? (o.locationNameAr || o.locationNameEn) : (o.locationNameEn || o.locationNameAr);
    const mappedLocation = data.locations.find(l => l.id === o.locationId)?.hasDeskMap || o.locationId === 'main-hall';
    const deskText = o.deskId && !mappedLocation ? (arabic ? ` · المكتب ${esc(o.deskId)}` : ` · Desk ${esc(o.deskId)}`) : '';
    const deskMap = mappedLocation && o.deskId ? renderStaffDeskMap(o.deskId, arabic) : '';
    const actions = o.status === 'New'
      ? `<button class="btn primary small" data-order-action="accept:${o.id}">${arabic ? 'تم استلام الطلب' : 'Accept order'}</button>`
      : o.status === 'Preparing'
        ? `<button class="btn success small" data-order-action="complete:${o.id}">${arabic ? 'تم تحضير الطلب' : 'Mark complete'}</button>`
        : '';
    const request = o.customRequest ? `<div class="order-request"><strong>${arabic ? 'طلب خاص:' : 'Special request:'}</strong> ${esc(o.customRequest)}</div>` : '';
    return `<article class="order-card ${o.status.toLowerCase()}"><div class="order-title"><strong>#${o.number}</strong><time>${arabic ? timeAgoAr(o.createdAt) : timeAgo(o.createdAt)}</time></div><div class="order-location">📍 ${esc(locationName)}${deskText}</div>${deskMap}<div class="order-drink">${esc(o.drinkIcon || icons[o.drinkNameEn] || '☕')} ${esc(drinkName)}</div><div class="order-meta"><span>${o.quantity} ${arabic ? 'كوب/طلب' : (o.quantity === 1 ? 'cup/item' : 'cups/items')}</span>${o.drinkId === CUSTOM_DRINK_ID ? `<span>${arabic ? 'طلب خاص' : 'Custom request'}</span>` : `<span>${o.sugarSpoons} ${arabic ? 'ملعقة سكر لكل كوب' : 'sugar spoon(s) / cup'}</span><span>${o.sugarSpoons * SUGAR_GRAMS_PER_SPOON} ${arabic ? 'جم سكر لكل كوب' : 'g sugar / cup'}</span>`}</div>${request}${actions ? `<div class="order-actions">${actions}</div>` : ''}</article>`;
  }

  function renderInventoryPanel() {
    const editing = editingMaterialId ? data.materials.find(m => m.id === editingMaterialId) : null;
    return `<div style="display:grid;gap:14px"><section class="card panel"><div class="panel-head"><div><h2>${editing ? 'Edit ingredient' : 'Add ingredient'}</h2><p>Add, edit or remove the materials used in drink recipes.</p></div>${editing ? '<button class="btn ghost small" data-action="cancel-material-edit">Cancel edit</button>' : ''}</div>
      <form id="materialForm" class="form-grid three">
        <input type="hidden" name="id" value="${esc(editing?.id || '')}">
        <div class="field"><label>Ingredient name (English)</label><input class="input" name="nameEn" required value="${esc(editing?.nameEn || '')}" placeholder="e.g. Coffee"></div>
        <div class="field"><label>Ingredient name (Arabic)</label><input class="input rtl-input" dir="rtl" name="nameAr" required value="${esc(editing?.nameAr || '')}" placeholder="مثال: قهوة"></div>
        <div class="field"><label>Base unit</label><select class="select" name="baseUnit">${['Gram','Milliliter','Piece'].map(u => `<option ${editing?.baseUnit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        <div class="field"><label>Package name</label><input class="input" name="packageName" required value="${esc(editing?.packageName || 'Pack')}" placeholder="Bag, Box, Bottle"></div>
        <div class="field"><label>Units per package</label><input class="input" type="number" step="0.001" min="0.001" name="unitsPerPackage" required value="${editing?.unitsPerPackage ?? 1}"></div>
        <div class="field"><label>Current stock</label><input class="input" type="number" step="0.001" min="0" name="currentQuantity" required value="${editing?.currentQuantity ?? 0}"></div>
        <div class="field"><label>Minimum stock alert</label><input class="input" type="number" step="0.001" min="0" name="minimumQuantity" required value="${editing?.minimumQuantity ?? 0}"></div>
        <div class="field"><label><input type="checkbox" name="active" ${editing ? (editing.active ? 'checked' : '') : 'checked'}> Active ingredient</label><span class="helper">Inactive ingredients cannot be used by new recipes.</span></div>
        <div style="display:flex;align-items:end"><button class="btn primary full" type="submit">${editing ? 'Save changes' : 'Add ingredient'}</button></div>
      </form>
    </section>
    <section class="card panel"><div class="panel-head"><div><h2>Ingredients & inventory</h2><p>${data.materials.length} ingredients logged.</p></div>${cloudEnabled() ? '' : '<button class="btn ghost small" data-action="reset-demo">Reset demo data</button>'}</div>
      <div class="table-wrap"><table><thead><tr><th>Ingredient</th><th>Arabic</th><th>Package</th><th>Current</th><th>Minimum</th><th>Status</th><th>Actions</th></tr></thead><tbody>${data.materials.map(m => {
        const low = m.active && Number(m.currentQuantity) <= Number(m.minimumQuantity);
        return `<tr><td><strong>${esc(m.nameEn)}</strong><div class="helper">${esc(m.baseUnit)}</div></td><td dir="rtl">${esc(m.nameAr)}</td><td>${esc(m.packageName)} · ${fmt(m.unitsPerPackage)} ${unitShort(m.baseUnit)}</td><td>${fmt(m.currentQuantity)} ${unitShort(m.baseUnit)}</td><td>${fmt(m.minimumQuantity)} ${unitShort(m.baseUnit)}</td><td><span class="status ${!m.active ? 'off' : low ? 'low' : 'ok'}">${!m.active ? 'Inactive' : low ? 'Low stock' : 'Available'}</span></td><td><div class="row-actions"><button class="btn soft small" data-material-edit="${esc(m.id)}">Edit</button><button class="btn danger small" data-material-delete="${esc(m.id)}">Delete</button></div></td></tr>`;
      }).join('')}</tbody></table></div>
    </section></div>`;
  }

  function renderDrinksPanel() {
    const editing = editingDrinkId ? data.drinks.find(d => d.id === editingDrinkId) : null;
    return `<div style="display:grid;gap:14px"><section class="card panel"><div class="panel-head"><div><h2>${editing ? 'Edit drink & recipe' : 'Add new drink'}</h2><p>English is shown to employees; Arabic is shown to the Barista.</p></div>${editing ? '<button class="btn ghost small" data-action="cancel-drink-edit">Cancel edit</button>' : ''}</div>
      <form id="drinkForm" class="form-grid">
        <input type="hidden" name="id" value="${esc(editing?.id || '')}">
        <div class="field"><label>Drink name (English)</label><input class="input" name="nameEn" required value="${esc(editing?.nameEn || '')}" placeholder="e.g. Cappuccino"></div>
        <div class="field"><label>Drink name (Arabic)</label><input class="input rtl-input" dir="rtl" name="nameAr" required value="${esc(editing?.nameAr || '')}" placeholder="مثال: كابتشينو"></div>
        <div class="field"><label>Icon / emoji</label><input class="input" name="icon" maxlength="8" value="${esc(editing?.icon || '☕')}" placeholder="☕"></div>
        <div class="field"><label>Category</label><input class="input" name="category" value="${esc(editing?.category || 'Drink')}" placeholder="Coffee, Tea, Herbal"></div>
        <div class="field span-2"><label>Employee description</label><input class="input" name="description" value="${esc(editing?.description || '')}" placeholder="Short description shown under the drink"></div>
        <div class="field"><label><input type="checkbox" name="active" ${editing ? (editing.active ? 'checked' : '') : 'checked'}> Active drink</label><span class="helper">Active drinks appear on the employee ordering screen.</span></div>
        <div class="span-2"><label style="font-size:13px;font-weight:800">Recipe ingredients</label><div class="ingredient-builder" id="ingredientBuilder">${renderIngredientDraft()}</div><button type="button" class="btn soft small" data-action="add-ingredient" style="margin-top:8px">+ Add recipe ingredient</button></div>
        <div class="span-2"><button class="btn primary" type="submit">${editing ? 'Save drink & recipe' : 'Add drink'}</button></div>
      </form>
    </section>
    <section class="card panel"><div class="panel-head"><div><h2>Drinks & recipes</h2><p>${data.drinks.filter(d => d.active).length} active drinks shown to employees.</p></div></div>
      <div class="recipe-grid">${data.drinks.map(d => `<article class="card recipe-card"><div class="recipe-top"><div><span class="eyebrow">${d.active ? 'ACTIVE' : 'INACTIVE'}</span><h3>${esc(d.icon || '☕')} ${esc(d.nameEn)}</h3><div class="arabic-name" dir="rtl">${esc(d.nameAr)}</div></div></div><div class="recipe-ingredients">${d.ingredients.map(i => {
        const m = data.materials.find(x => x.id === i.materialId); return `<div class="ingredient-line"><span>${esc(m?.nameEn || 'Missing ingredient')}</span><strong>${fmt(i.amount)} ${unitShort(m?.baseUnit || '')}</strong></div>`;
      }).join('') || '<div class="helper">No recipe ingredients.</div>'}</div><div class="row-actions"><button class="btn soft small" data-drink-edit="${esc(d.id)}">Edit</button><button class="btn danger small" data-drink-delete="${esc(d.id)}">Delete</button></div></article>`).join('')}</div>
    </section></div>`;
  }

  function renderIngredientDraft() {
    const activeMaterials = data.materials.filter(m => m.active);
    return ingredientDraft.map((row, idx) => {
      const options = activeMaterials.map(m => `<option value="${esc(m.id)}" ${m.id === row.materialId ? 'selected' : ''}>${esc(m.nameEn)} (${unitShort(m.baseUnit)})</option>`).join('');
      return `<div class="ingredient-row"><select class="select" data-ingredient-material="${idx}">${options}</select><input class="input" type="number" min="0.001" step="0.001" value="${row.amount}" data-ingredient-amount="${idx}" aria-label="Amount"><button type="button" class="btn danger small" data-remove-ingredient="${idx}" title="Remove">×</button></div>`;
    }).join('');
  }

  function renderLocationsPanel() {
    const editing = editingLocationId ? data.locations.find(l => l.id === editingLocationId) : null;
    return `<div style="display:grid;gap:14px"><section class="card panel"><div class="panel-head"><div><h2>${editing ? 'Edit location' : 'Add location'}</h2><p>English appears for employees. Arabic appears on Barista orders.</p></div>${editing ? '<button class="btn ghost small" data-action="cancel-location-edit">Cancel edit</button>' : ''}</div>
      <form id="locationForm" class="form-grid">
        <input type="hidden" name="id" value="${esc(editing?.id || '')}">
        <div class="field"><label>Location name (English)</label><input class="input" name="nameEn" required value="${esc(editing?.nameEn || '')}" placeholder="e.g. Meeting Room"></div>
        <div class="field"><label>Location name (Arabic)</label><input class="input rtl-input" dir="rtl" name="nameAr" required value="${esc(editing?.nameAr || '')}" placeholder="مثال: غرفة الاجتماعات"></div>
        <div class="field"><label>Display order</label><input class="input" type="number" min="0" step="1" name="sortOrder" value="${editing?.sortOrder ?? data.locations.length}"></div>
        <div class="field"><label><input type="checkbox" name="active" ${editing ? (editing.active ? 'checked' : '') : 'checked'}> Active location</label><span class="helper">Inactive locations stay in old order history but cannot be selected.</span></div>
        <div class="field span-2"><label><input type="checkbox" name="hasDeskMap" ${editing?.hasDeskMap ? 'checked' : ''}> Use the Main Hall desk picker for this location</label><span class="helper">Keep this enabled for Main Hall. New normal offices usually leave it off.</span></div>
        <div class="span-2"><button class="btn primary" type="submit">${editing ? 'Save location' : 'Add location'}</button></div>
      </form>
    </section>
    <section class="card panel"><div class="panel-head"><div><h2>Delivery locations</h2><p>${data.locations.filter(l => l.active).length} active locations.</p></div></div><div class="location-admin-grid">${data.locations.slice().sort((a,b)=>a.sortOrder-b.sortOrder).map(l => `<article class="card location-admin-card"><div><span class="eyebrow">${l.active ? 'ACTIVE' : 'INACTIVE'}</span><h3>${esc(l.nameEn)}</h3><p dir="rtl">${esc(l.nameAr)}</p>${l.hasDeskMap ? '<span class="status ok">Desk map enabled</span>' : ''}</div><div class="row-actions"><button class="btn soft small" data-location-edit="${esc(l.id)}">Edit</button><button class="btn danger small" data-location-delete="${esc(l.id)}">Delete</button></div></article>`).join('')}</div></section></div>`;
  }

  function renderCloudPanel() {
    return `<section class="card panel"><div class="panel-head"><div><h2>Shared database</h2><p>This is what makes orders placed on employee phones appear on the Barista computer.</p></div><span class="status ${cloudEnabled() ? 'ok' : 'low'}">${cloudEnabled() ? 'Connected mode enabled' : 'Not configured'}</span></div>
      ${cloudEnabled() ? `<div class="cloud-grid"><div class="notice success-note"><strong>Cloud mode is enabled.</strong><br>The app will poll the shared order queue every ${Math.round(Number(CLOUD.pollMs || 2000)/1000)} seconds on the Barista screen.</div><div class="cloud-actions"><button class="btn primary" data-action="sync-cloud">Sync now</button><button class="btn ghost" data-action="migrate-local">Move this browser's current drinks, ingredients & locations to cloud</button></div></div>` : `<div class="notice warn"><strong>Cross-device ordering is not active yet.</strong><br>Open <code>SHARED-DATABASE-SETUP.md</code>, run the included Supabase SQL once, then fill in <code>cloud-config.js</code> and set <code>enabled: true</code>.</div>`}
      <div class="notice info" style="margin-top:12px"><strong>Preserving your existing Admin data:</strong> this version keeps the same browser storage key as the code you sent. Any ingredients you previously added in this same browser/origin remain available locally. After cloud setup, use the migration button above once to copy them to the shared database.</div>
    </section>`;
  }

  function render404() { go('order'); }

  function render() {
    reloadCache();
    const r = route();
    if (r === 'order') return renderOrder();
    if (r === 'login') return renderLogin();
    if (r === 'barista') return renderBarista();
    if (r === 'admin') return renderAdmin();
    return render404();
  }

  function scrollToStep(id) {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 70);
  }

  async function placeOrder() {
    const drink = selectedDrink();
    const loc = selectedLocation();
    orderUi.customRequest = document.getElementById('customRequest')?.value.trim() || orderUi.customRequest.trim();
    orderUi.customLocation = document.getElementById('customLocation')?.value.trim() || orderUi.customLocation.trim();
    if (!drink) return toast('Please choose a drink first.', 'error');
    if (!loc) return toast('Please choose your location.', 'error');
    if (orderUi.locationId === CUSTOM_LOCATION_ID && !orderUi.customLocation) return toast('Please type your custom location.', 'error');
    if (loc.hasDeskMap && !orderUi.deskId) return toast('Please choose your Main Hall desk.', 'error');
    if (drink.id === CUSTOM_DRINK_ID && !orderUi.customRequest) return toast('Please type your custom request.', 'error');
    if (orderUi.quantity < 1 || orderUi.quantity > 10) return toast('Quantity must be between 1 and 10.', 'error');
    if (orderUi.sugarSpoons < 0 || orderUi.sugarSpoons > 10) return toast('Sugar must be between 0 and 10 spoons.', 'error');

    if (!cloudEnabled() && hostedProduction()) {
      toast('Shared ordering is not connected yet. This order was NOT sent to the Barista.', 'error');
      return;
    }

    if (cloudEnabled()) {
      try {
        setCloudBusy(true);
        const result = await cloudRequest('/rest/v1/rpc/place_pantry_order', {
          method: 'POST',
          body: {
            p_drink_id: drink.id,
            p_quantity: orderUi.quantity,
            p_sugar_spoons: drink.id === CUSTOM_DRINK_ID ? 0 : orderUi.sugarSpoons,
            p_location_id: loc.id,
            p_desk_id: orderUi.deskId || null,
            p_custom_location: orderUi.locationId === CUSTOM_LOCATION_ID ? orderUi.customLocation : null,
            p_custom_request: orderUi.customRequest || null
          },
          auth: false
        });
        const order = Array.isArray(result) ? result[0] : result;
        if (order?.id) rememberMyOrder(order.id);
        await syncCatalogFromCloud();
        toast(`Order #${order?.number || ''} sent to the pantry.`, 'success');
      } catch (err) {
        toast(humanCloudError(err), 'error');
        return;
      } finally { setCloudBusy(false); }
    } else {
      const localResult = placeOrderLocal(drink, loc);
      if (!localResult) return;
      toast(`Order #${localResult.number} sent to the pantry.`, 'success');
    }

    orderUi = { selectedDrinkId: '', locationId: '', deskId: '', customLocation: '', quantity: 1, sugarSpoons: 0, customRequest: '' };
    renderOrder();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function placeOrderLocal(drink, loc) {
    const requirements = new Map();
    if (drink.id !== CUSTOM_DRINK_ID) {
      for (const ing of drink.ingredients) requirements.set(ing.materialId, (requirements.get(ing.materialId) || 0) + Number(ing.amount) * orderUi.quantity);
      if (orderUi.sugarSpoons > 0) {
        const sugar = data.materials.find(m => m.active && (m.id === 'sugar' || m.nameEn.toLowerCase() === 'sugar') && m.baseUnit === 'Gram');
        if (!sugar) { toast('Active Sugar inventory in grams was not found.', 'error'); return null; }
        requirements.set(sugar.id, (requirements.get(sugar.id) || 0) + orderUi.sugarSpoons * SUGAR_GRAMS_PER_SPOON * orderUi.quantity);
      }
      for (const [materialId, required] of requirements) {
        const material = data.materials.find(m => m.id === materialId && m.active);
        if (!material) { toast('A recipe ingredient is missing or inactive.', 'error'); return null; }
        if (Number(material.currentQuantity) < required) { toast(`Not enough ${material.nameEn}. Need ${fmt(required)} ${unitShort(material.baseUnit)}; available ${fmt(material.currentQuantity)}.`, 'error'); return null; }
      }
      for (const [materialId, required] of requirements) data.materials.find(m => m.id === materialId).currentQuantity -= required;
    }

    const order = {
      id: uid('order'), number: data.nextOrderNumber++, drinkId: drink.id, drinkNameEn: drink.nameEn, drinkNameAr: drink.nameAr, drinkIcon: drink.icon,
      locationId: loc.id, locationNameEn: orderUi.locationId === CUSTOM_LOCATION_ID ? orderUi.customLocation : loc.nameEn, locationNameAr: orderUi.locationId === CUSTOM_LOCATION_ID ? `موقع مخصص: ${orderUi.customLocation}` : loc.nameAr, deskId: orderUi.deskId || '', quantity: orderUi.quantity,
      sugarSpoons: drink.id === CUSTOM_DRINK_ID ? 0 : orderUi.sugarSpoons, customRequest: orderUi.customRequest || '', status: 'New', createdAt: nowIso(), acceptedAt: null, completedAt: null
    };
    data.orders.unshift(order); rememberMyOrder(order.id); saveCache();
    channel?.postMessage({ type: 'new-order', orderId: order.id });
    return order;
  }

  function rememberMyOrder(id) {
    try {
      const ids = JSON.parse(localStorage.getItem(MY_ORDER_IDS_KEY) || '[]').filter(Boolean);
      localStorage.setItem(MY_ORDER_IDS_KEY, JSON.stringify([id, ...ids.filter(x => x !== id)].slice(0, 10)));
    } catch { /* optional */ }
  }

  async function updateOrder(action, id) {
    const o = data.orders.find(x => x.id === id);
    if (!o) return;
    const patch = action === 'accept' && o.status === 'New' ? { status: 'Preparing', acceptedAt: nowIso() } : action === 'complete' && o.status === 'Preparing' ? { status: 'Completed', completedAt: nowIso() } : null;
    if (!patch) return;

    if (cloudEnabled()) {
      try {
        setCloudBusy(true);
        await cloudRequest(`/rest/v1/pantry_orders?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: toCloudOrderPatch(patch), auth: true, prefer: 'return=minimal' });
        Object.assign(o, patch); saveCache({ broadcast: false });
      } catch (err) { toast(humanCloudError(err), 'error'); return; }
      finally { setCloudBusy(false); }
    } else {
      Object.assign(o, patch); saveCache();
    }
    if (action === 'accept') toast('تم استلام الطلب. توقف الجرس لهذا الطلب.', 'success');
    else toast('تم تحضير الطلب.', 'success');
    render();
    updateBellLoop();
  }

  async function submitLogin(form) {
    const fd = new FormData(form);
    const username = String(fd.get('username') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');
    const role = loginRole;
    if (username !== role) return toast(role === 'barista' ? 'اسم المستخدم غير صحيح.' : 'Incorrect username.', 'error');

    if (cloudEnabled()) {
      try {
        setCloudBusy(true);
        const email = role === 'admin' ? CLOUD.adminEmail : CLOUD.baristaEmail;
        const auth = await supabasePasswordLogin(email, password);
        setSession({ role: role === 'admin' ? 'Admin' : 'Barista', username: role, email, accessToken: auth.access_token, refreshToken: auth.refresh_token, expiresAt: Date.now() + Number(auth.expires_in || 3600) * 1000, loginAt: nowIso() });
        await syncAllFromCloud(true);
      } catch (err) { toast(role === 'barista' ? 'تعذر تسجيل الدخول. تحقق من كلمة المرور.' : 'Could not sign in. Check the password and Supabase staff user.', 'error'); return; }
      finally { setCloudBusy(false); }
    } else {
      const expected = LOCAL_STAFF[role];
      if (password !== expected.password) return toast(role === 'barista' ? 'كلمة المرور غير صحيحة.' : 'Incorrect password.', 'error');
      setSession({ role: expected.role, username: expected.username, loginAt: nowIso() });
    }

    if (role === 'barista') enableBell(true);
    toast(role === 'barista' ? 'تم تسجيل الدخول.' : 'Signed in as Admin.', 'success');
    go(role === 'admin' ? 'admin' : 'barista');
  }

  async function submitMaterial(form) {
    const fd = new FormData(form);
    const id = String(fd.get('id') || '');
    const old = id ? data.materials.find(m => m.id === id) : null;
    const obj = {
      id: id || uid('mat'), nameEn: String(fd.get('nameEn') || '').trim(), nameAr: String(fd.get('nameAr') || '').trim(), baseUnit: String(fd.get('baseUnit')),
      packageName: String(fd.get('packageName') || '').trim(), unitsPerPackage: Number(fd.get('unitsPerPackage')), currentQuantity: Number(fd.get('currentQuantity')),
      minimumQuantity: Number(fd.get('minimumQuantity')), active: fd.get('active') === 'on', createdAt: old?.createdAt || nowIso()
    };
    if (!obj.nameEn || !obj.nameAr) return toast('English and Arabic ingredient names are required.', 'error');
    try {
      if (cloudEnabled()) await cloudSaveMaterial(obj, Boolean(id));
      if (old) Object.assign(old, obj); else data.materials.push(obj);
      editingMaterialId = null; saveCache({ broadcast: !cloudEnabled() }); toast(id ? 'Ingredient updated.' : 'Ingredient added.', 'success'); renderAdmin();
    } catch (err) { toast(humanCloudError(err), 'error'); }
  }

  async function submitDrink(form) {
    const fd = new FormData(form);
    const id = String(fd.get('id') || '');
    const old = id ? data.drinks.find(d => d.id === id) : null;
    const ingredients = ingredientDraft.filter(i => i.materialId && Number(i.amount) > 0).map(i => ({ materialId: i.materialId, amount: Number(i.amount) }));
    const obj = {
      id: id || uid('drink'), nameEn: String(fd.get('nameEn') || '').trim(), nameAr: String(fd.get('nameAr') || '').trim(), icon: String(fd.get('icon') || '☕').trim() || '☕',
      category: String(fd.get('category') || 'Drink').trim() || 'Drink', description: String(fd.get('description') || '').trim(), active: fd.get('active') === 'on', ingredients, createdAt: old?.createdAt || nowIso()
    };
    if (!obj.nameEn || !obj.nameAr) return toast('English and Arabic drink names are required.', 'error');
    if (!ingredients.length) return toast('Add at least one recipe ingredient.', 'error');
    try {
      if (cloudEnabled()) await cloudSaveDrink(obj, Boolean(id));
      if (old) Object.assign(old, obj); else data.drinks.push(obj);
      editingDrinkId = null; ingredientDraft = [{ materialId: data.materials.find(m => m.active)?.id || '', amount: 1 }]; saveCache({ broadcast: !cloudEnabled() }); toast(id ? 'Drink & recipe updated.' : 'Drink added.', 'success'); renderAdmin();
    } catch (err) { toast(humanCloudError(err), 'error'); }
  }

  async function submitLocation(form) {
    const fd = new FormData(form);
    const id = String(fd.get('id') || '');
    const old = id ? data.locations.find(l => l.id === id) : null;
    const obj = { id: id || uid('loc'), nameEn: String(fd.get('nameEn') || '').trim(), nameAr: String(fd.get('nameAr') || '').trim(), sortOrder: Number(fd.get('sortOrder') || 0), active: fd.get('active') === 'on', hasDeskMap: fd.get('hasDeskMap') === 'on', createdAt: old?.createdAt || nowIso() };
    if (!obj.nameEn || !obj.nameAr) return toast('English and Arabic location names are required.', 'error');
    try {
      if (cloudEnabled()) await cloudSaveLocation(obj, Boolean(id));
      if (old) Object.assign(old, obj); else data.locations.push(obj);
      editingLocationId = null; saveCache({ broadcast: !cloudEnabled() }); toast(id ? 'Location updated.' : 'Location added.', 'success'); renderAdmin();
    } catch (err) { toast(humanCloudError(err), 'error'); }
  }

  async function deleteMaterial(id) {
    const inUse = data.drinks.some(d => d.ingredients.some(i => i.materialId === id));
    if (inUse) return toast('This ingredient is used by a drink recipe. Edit or remove that recipe first.', 'error');
    const m = data.materials.find(x => x.id === id); if (!m || !confirm(`Delete ${m.nameEn}?`)) return;
    try { if (cloudEnabled()) await cloudRequest(`/rest/v1/pantry_materials?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }); data.materials = data.materials.filter(x => x.id !== id); saveCache({ broadcast: !cloudEnabled() }); renderAdmin(); } catch (err) { toast(humanCloudError(err), 'error'); }
  }

  async function deleteDrink(id) {
    const d = data.drinks.find(x => x.id === id); if (!d || !confirm(`Delete ${d.nameEn}?`)) return;
    try { if (cloudEnabled()) await cloudRequest(`/rest/v1/pantry_drinks?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }); data.drinks = data.drinks.filter(x => x.id !== id); saveCache({ broadcast: !cloudEnabled() }); renderAdmin(); } catch (err) { toast(humanCloudError(err), 'error'); }
  }

  async function deleteLocation(id) {
    const l = data.locations.find(x => x.id === id); if (!l || !confirm(`Delete ${l.nameEn}? Old orders will keep their saved location name.`)) return;
    try { if (cloudEnabled()) await cloudRequest(`/rest/v1/pantry_locations?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }); data.locations = data.locations.filter(x => x.id !== id); saveCache({ broadcast: !cloudEnabled() }); renderAdmin(); } catch (err) { toast(humanCloudError(err), 'error'); }
  }

  function resetDemo() {
    if (!confirm('Reset local orders, drinks, ingredients, inventory and locations to the default demo data?')) return;
    data = defaultData(); saveCache(); editingMaterialId = editingDrinkId = editingLocationId = null; ingredientDraft = [{ materialId: data.materials[0]?.id || '', amount: 1 }]; toast('Local demo data reset.', 'success'); renderAdmin();
  }

  // ---------------------- Coffee-shop bell ----------------------
  const bellAudio = new Audio('assets/coffee-shop-bell.wav');
  bellAudio.preload = 'auto';
  bellAudio.volume = 1.0;
  let bellEnabled = false;
  let bellTimer = null;

  function enableBell(playNow = false) {
    bellEnabled = true;
    try {
      bellAudio.currentTime = 0;
      const p = bellAudio.play();
      if (p?.then) p.then(() => { if (!playNow) { bellAudio.pause(); bellAudio.currentTime = 0; } }).catch(() => { bellEnabled = false; });
    } catch { bellEnabled = false; }
    setTimeout(() => { if (route() === 'barista') renderBarista(); }, 100);
  }

  function playCafeBell() {
    if (!bellEnabled) return;
    try { bellAudio.pause(); bellAudio.currentTime = 0; bellAudio.volume = 1.0; bellAudio.play().catch(() => { bellEnabled = false; clearBellLoop(); if (route() === 'barista') renderBarista(); }); } catch { /* audio optional */ }
  }

  function updateBellLoop() {
    const shouldRing = route() === 'barista' && canAccess('barista') && data.orders.some(o => o.status === 'New');
    if (!shouldRing || !bellEnabled) return clearBellLoop();
    if (!bellTimer) {
      playCafeBell();
      bellTimer = setInterval(() => {
        if (route() !== 'barista' || !data.orders.some(o => o.status === 'New')) return clearBellLoop();
        playCafeBell();
      }, 2300);
    }
  }

  function clearBellLoop() { if (bellTimer) clearInterval(bellTimer); bellTimer = null; }

  function timeAgo(iso) {
    const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`; const min = Math.floor(sec / 60); if (min < 60) return `${min}m ago`; const hr = Math.floor(min / 60); if (hr < 24) return `${hr}h ago`; return new Date(iso).toLocaleDateString();
  }

  function timeAgoAr(iso) {
    const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (sec < 60) return `منذ ${sec} ث`; const min = Math.floor(sec / 60); if (min < 60) return `منذ ${min} د`; const hr = Math.floor(min / 60); if (hr < 24) return `منذ ${hr} س`; return new Date(iso).toLocaleDateString('ar-EG');
  }

  function toast(message, type = '') {
    const host = document.getElementById('toastHost'); if (!host) return;
    const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; host.appendChild(el); setTimeout(() => el.remove(), 4000);
  }

  function setCloudBusy(v) { cloudBusy = v; document.body.classList.toggle('is-busy', Boolean(v)); }

  // ---------------------- Supabase REST/Auth adapter ----------------------
  async function cloudRequest(path, { method = 'GET', body, auth = false, prefer = 'return=representation', retry = true } = {}) {
    if (!cloudEnabled()) throw new Error('Shared database is not configured.');
    const s = session();
    if (auth && !s?.accessToken) throw new Error('Staff authentication is required.');
    const headers = { apikey: CLOUD.anonKey, Authorization: `Bearer ${auth ? s.accessToken : CLOUD.anonKey}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    let res = await fetch(`${String(CLOUD.supabaseUrl).replace(/\/$/, '')}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.status === 401 && auth && retry && s?.refreshToken) {
      const refreshed = await refreshSupabaseSession();
      if (refreshed) return cloudRequest(path, { method, body, auth, prefer, retry: false });
    }
    const text = await res.text();
    if (!res.ok) throw new Error(text || `${res.status} ${res.statusText}`);
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  async function supabasePasswordLogin(email, password) {
    const res = await fetch(`${String(CLOUD.supabaseUrl).replace(/\/$/, '')}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: CLOUD.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error_description || json.msg || 'Authentication failed');
    return json;
  }

  async function refreshSupabaseSession() {
    const s = session(); if (!s?.refreshToken) return false;
    try {
      const res = await fetch(`${String(CLOUD.supabaseUrl).replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: CLOUD.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refreshToken }) });
      const json = await res.json(); if (!res.ok) return false;
      setSession({ ...s, accessToken: json.access_token, refreshToken: json.refresh_token || s.refreshToken, expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000 }); return true;
    } catch { return false; }
  }

  const fromCloudMaterial = r => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar, baseUnit: r.base_unit, packageName: r.package_name, unitsPerPackage: Number(r.units_per_package), currentQuantity: Number(r.current_quantity), minimumQuantity: Number(r.minimum_quantity), active: r.active, createdAt: r.created_at });
  const toCloudMaterial = m => ({ id: m.id, name_en: m.nameEn, name_ar: m.nameAr, base_unit: m.baseUnit, package_name: m.packageName, units_per_package: m.unitsPerPackage, current_quantity: m.currentQuantity, minimum_quantity: m.minimumQuantity, active: m.active, created_at: m.createdAt });
  const fromCloudDrink = r => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar, icon: r.icon || '☕', category: r.category || 'Drink', description: r.description || '', ingredients: Array.isArray(r.ingredients) ? r.ingredients : [], active: r.active, createdAt: r.created_at });
  const toCloudDrink = d => ({ id: d.id, name_en: d.nameEn, name_ar: d.nameAr, icon: d.icon, category: d.category, description: d.description, ingredients: d.ingredients, active: d.active, created_at: d.createdAt });
  const fromCloudLocation = r => ({ id: r.id, nameEn: r.name_en, nameAr: r.name_ar, hasDeskMap: r.has_desk_map, active: r.active, sortOrder: Number(r.sort_order || 0), createdAt: r.created_at });
  const toCloudLocation = l => ({ id: l.id, name_en: l.nameEn, name_ar: l.nameAr, has_desk_map: l.hasDeskMap, active: l.active, sort_order: l.sortOrder, created_at: l.createdAt });
  const fromCloudOrder = r => ({ id: r.id, number: r.number, drinkId: r.drink_id, drinkNameEn: r.drink_name_en, drinkNameAr: r.drink_name_ar, drinkIcon: r.drink_icon || '☕', locationId: r.location_id, locationNameEn: r.location_name_en, locationNameAr: r.location_name_ar, deskId: r.desk_id || '', quantity: Number(r.quantity || 1), sugarSpoons: Number(r.sugar_spoons || 0), customRequest: r.custom_request || '', status: r.status, createdAt: r.created_at, acceptedAt: r.accepted_at, completedAt: r.completed_at });
  const toCloudOrderPatch = p => ({ ...(p.status ? { status: p.status } : {}), ...(p.acceptedAt ? { accepted_at: p.acceptedAt } : {}), ...(p.completedAt ? { completed_at: p.completedAt } : {}) });

  async function syncCatalogFromCloud() {
    if (!cloudEnabled()) return;
    const [mats, drinks, locs] = await Promise.all([
      cloudRequest('/rest/v1/pantry_materials?select=*&order=name_en.asc'),
      cloudRequest('/rest/v1/pantry_drinks?select=*&order=name_en.asc'),
      cloudRequest('/rest/v1/pantry_locations?select=*&order=sort_order.asc')
    ]);
    if (Array.isArray(mats) && mats.length) data.materials = mats.map(fromCloudMaterial);
    if (Array.isArray(drinks) && drinks.length) data.drinks = drinks.map(fromCloudDrink);
    if (Array.isArray(locs) && locs.length) data.locations = locs.map(fromCloudLocation);
    saveCache({ broadcast: false });
  }

  async function syncOrdersFromCloud() {
    if (!cloudEnabled() || !session()?.accessToken) return;
    const rows = await cloudRequest('/rest/v1/pantry_orders?select=*&order=created_at.desc&limit=250', { auth: true });
    if (Array.isArray(rows)) data.orders = rows.map(fromCloudOrder);
    saveCache({ broadcast: false });
  }

  async function syncAllFromCloud(includeOrders = false) {
    await syncCatalogFromCloud();
    if (includeOrders && session()?.accessToken) await syncOrdersFromCloud();
  }

  async function cloudSaveMaterial(obj, editing) {
    if (editing) return cloudRequest(`/rest/v1/pantry_materials?id=eq.${encodeURIComponent(obj.id)}`, { method: 'PATCH', body: toCloudMaterial(obj), auth: true });
    return cloudRequest('/rest/v1/pantry_materials', { method: 'POST', body: toCloudMaterial(obj), auth: true });
  }

  async function cloudSaveDrink(obj, editing) {
    if (editing) return cloudRequest(`/rest/v1/pantry_drinks?id=eq.${encodeURIComponent(obj.id)}`, { method: 'PATCH', body: toCloudDrink(obj), auth: true });
    return cloudRequest('/rest/v1/pantry_drinks', { method: 'POST', body: toCloudDrink(obj), auth: true });
  }

  async function cloudSaveLocation(obj, editing) {
    if (editing) return cloudRequest(`/rest/v1/pantry_locations?id=eq.${encodeURIComponent(obj.id)}`, { method: 'PATCH', body: toCloudLocation(obj), auth: true });
    return cloudRequest('/rest/v1/pantry_locations', { method: 'POST', body: toCloudLocation(obj), auth: true });
  }

  async function migrateLocalToCloud() {
    if (!cloudEnabled() || session()?.role !== 'Admin') return toast('Admin cloud login is required.', 'error');
    if (!confirm('Copy the drinks, ingredients and locations currently stored in this browser into the shared database? Matching IDs will be updated.')) return;
    try {
      setCloudBusy(true);
      const source = normalizeData(preCloudLocalSnapshot);
      await cloudRequest('/rest/v1/pantry_materials?on_conflict=id', { method: 'POST', body: source.materials.map(toCloudMaterial), auth: true, prefer: 'resolution=merge-duplicates,return=minimal' });
      await cloudRequest('/rest/v1/pantry_drinks?on_conflict=id', { method: 'POST', body: source.drinks.map(toCloudDrink), auth: true, prefer: 'resolution=merge-duplicates,return=minimal' });
      await cloudRequest('/rest/v1/pantry_locations?on_conflict=id', { method: 'POST', body: source.locations.map(toCloudLocation), auth: true, prefer: 'resolution=merge-duplicates,return=minimal' });
      await syncCatalogFromCloud(); toast('Existing browser pantry data copied to the shared database.', 'success'); renderAdmin();
    } catch (err) { toast(humanCloudError(err), 'error'); }
    finally { setCloudBusy(false); }
  }

  function humanCloudError(err) {
    const msg = String(err?.message || err || 'Shared database error');
    if (msg.includes('insufficient_stock')) return 'Not enough inventory for this order.';
    if (msg.includes('staff authentication')) return 'Please sign in again.';
    if (msg.length > 180) return 'Shared database request failed. Check cloud-config.js and the Supabase setup.';
    return msg;
  }

  async function refreshBaristaFromCloud() {
    if (!cloudEnabled() || route() !== 'barista' || !canAccess('barista') || cloudBusy) return;
    try {
      const before = JSON.stringify(data.orders.map(o => [o.id, o.status]));
      await syncOrdersFromCloud();
      const after = JSON.stringify(data.orders.map(o => [o.id, o.status]));
      if (before !== after) renderBarista();
      else updateBellLoop();
    } catch { /* keep UI usable; the next foreground/poll event retries */ }
  }

  function startCloudPolling() {
    clearInterval(pollTimer); clearInterval(catalogTimer);
    if (!cloudEnabled()) return;
    pollTimer = setInterval(refreshBaristaFromCloud, Math.max(1200, Number(CLOUD.pollMs || 2000)));
    catalogTimer = setInterval(async () => {
      if (cloudBusy) return;
      try { await syncCatalogFromCloud(); if (route() === 'order') renderOrder(); } catch { /* retry later */ }
    }, 30000);
  }

  // ---------------------- Events ----------------------
  document.addEventListener('click', async event => {
    const goEl = event.target.closest('[data-go]'); if (goEl) return go(goEl.dataset.go);
    const drinkEl = event.target.closest('[data-drink]'); if (drinkEl) {
      orderUi.selectedDrinkId = drinkEl.dataset.drink; orderUi.customRequest = ''; renderOrder(); scrollToStep('locationStep'); return;
    }
    const locationEl = event.target.closest('[data-location]'); if (locationEl) {
      orderUi.locationId = locationEl.dataset.location; orderUi.deskId = ''; if (orderUi.locationId !== CUSTOM_LOCATION_ID) orderUi.customLocation = ''; renderOrder();
      const l = selectedLocation(); if (orderUi.locationId === CUSTOM_LOCATION_ID) setTimeout(() => document.getElementById('customLocation')?.focus(), 80); else if (!l?.hasDeskMap) scrollToStep('customStep'); else scrollToStep('locationStep'); return;
    }
    const deskEl = event.target.closest('[data-desk]'); if (deskEl) { orderUi.deskId = deskEl.dataset.desk; renderOrder(); scrollToStep('customStep'); return; }
    const stepEl = event.target.closest('[data-step]'); if (stepEl) {
      orderUi.customRequest = document.getElementById('customRequest')?.value || orderUi.customRequest;
      const [kind, raw] = stepEl.dataset.step.split(':'); const delta = Number(raw);
      if (kind === 'quantity') orderUi.quantity = Math.min(10, Math.max(1, orderUi.quantity + delta));
      if (kind === 'sugar') orderUi.sugarSpoons = Math.min(10, Math.max(0, orderUi.sugarSpoons + delta));
      return renderOrder();
    }
    const actionEl = event.target.closest('[data-action]'); if (actionEl) {
      const action = actionEl.dataset.action;
      if (action === 'place-order') return placeOrder();
      if (action === 'logout') { clearBellLoop(); setSession(null); toast('Signed out.'); return go('order'); }
      if (action === 'enable-bell') { enableBell(true); updateBellLoop(); return; }
      if (action === 'refresh') { if (cloudEnabled()) { try { await syncAllFromCloud(true); } catch {} } return render(); }
      if (action === 'reset-demo') return resetDemo();
      if (action === 'add-ingredient') { ingredientDraft.push({ materialId: data.materials.find(m => m.active)?.id || '', amount: 1 }); return renderAdmin(); }
      if (action === 'cancel-material-edit') { editingMaterialId = null; return renderAdmin(); }
      if (action === 'cancel-drink-edit') { editingDrinkId = null; ingredientDraft = [{ materialId: data.materials.find(m => m.active)?.id || '', amount: 1 }]; return renderAdmin(); }
      if (action === 'cancel-location-edit') { editingLocationId = null; return renderAdmin(); }
      if (action === 'sync-cloud') { try { setCloudBusy(true); await syncAllFromCloud(true); toast('Shared data synced.', 'success'); renderAdmin(); } catch (err) { toast(humanCloudError(err), 'error'); } finally { setCloudBusy(false); } return; }
      if (action === 'migrate-local') return migrateLocalToCloud();
    }
    const roleEl = event.target.closest('[data-role]'); if (roleEl) { loginRole = roleEl.dataset.role; return renderLogin(); }
    const tabEl = event.target.closest('[data-tab]'); if (tabEl) { adminTab = tabEl.dataset.tab; return renderAdmin(); }
    const orderEl = event.target.closest('[data-order-action]'); if (orderEl) { const [action, id] = orderEl.dataset.orderAction.split(':'); return updateOrder(action, id); }
    const materialEdit = event.target.closest('[data-material-edit]'); if (materialEdit) { editingMaterialId = materialEdit.dataset.materialEdit; return renderAdmin(); }
    const materialDelete = event.target.closest('[data-material-delete]'); if (materialDelete) return deleteMaterial(materialDelete.dataset.materialDelete);
    const drinkEdit = event.target.closest('[data-drink-edit]'); if (drinkEdit) { editingDrinkId = drinkEdit.dataset.drinkEdit; const d = data.drinks.find(x => x.id === editingDrinkId); ingredientDraft = d?.ingredients.map(i => ({ ...i })) || [{ materialId: data.materials[0]?.id || '', amount: 1 }]; return renderAdmin(); }
    const drinkDelete = event.target.closest('[data-drink-delete]'); if (drinkDelete) return deleteDrink(drinkDelete.dataset.drinkDelete);
    const locationEdit = event.target.closest('[data-location-edit]'); if (locationEdit) { editingLocationId = locationEdit.dataset.locationEdit; return renderAdmin(); }
    const locationDelete = event.target.closest('[data-location-delete]'); if (locationDelete) return deleteLocation(locationDelete.dataset.locationDelete);
    const removeIng = event.target.closest('[data-remove-ingredient]'); if (removeIng) { const idx = Number(removeIng.dataset.removeIngredient); ingredientDraft.splice(idx, 1); if (!ingredientDraft.length) ingredientDraft.push({ materialId: data.materials.find(m => m.active)?.id || '', amount: 1 }); return renderAdmin(); }
  });

  document.addEventListener('change', event => {
    if (event.target.matches('[data-ingredient-material]')) ingredientDraft[Number(event.target.dataset.ingredientMaterial)].materialId = event.target.value;
    if (event.target.matches('[data-ingredient-amount]')) ingredientDraft[Number(event.target.dataset.ingredientAmount)].amount = Number(event.target.value);
  });

  document.addEventListener('input', event => { if (event.target.id === 'customRequest') orderUi.customRequest = event.target.value; if (event.target.id === 'customLocation') orderUi.customLocation = event.target.value; });

  document.addEventListener('submit', event => {
    if (event.target.id === 'loginForm') { event.preventDefault(); return submitLogin(event.target); }
    if (event.target.id === 'materialForm') { event.preventDefault(); return submitMaterial(event.target); }
    if (event.target.id === 'drinkForm') { event.preventDefault(); return submitDrink(event.target); }
    if (event.target.id === 'locationForm') { event.preventDefault(); return submitLocation(event.target); }
  });

  window.addEventListener('hashchange', () => { clearBellLoop(); render(); if (route() === 'barista') { updateBellLoop(); refreshBaristaFromCloud(); } });
  window.addEventListener('storage', event => { if (event.key === APP_KEY && !cloudEnabled()) { reloadCache(); render(); if (route() === 'barista') updateBellLoop(); } });
  channel?.addEventListener('message', ev => { if (!cloudEnabled() && (ev.data?.type === 'data-changed' || ev.data?.type === 'new-order')) { reloadCache(); render(); if (route() === 'barista') updateBellLoop(); } });
  // Mobile browsers throttle timers while backgrounded. Refresh immediately when the Barista returns.
  window.addEventListener('focus', refreshBaristaFromCloud);
  window.addEventListener('online', refreshBaristaFromCloud);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshBaristaFromCloud(); });

  async function bootstrap() {
    // First page shown in a new tab must always be Employee Order, unless staff is already signed in in this tab.
    if (!sessionStorage.getItem(START_KEY)) {
      sessionStorage.setItem(START_KEY, '1');
      if (!session()) history.replaceState(null, '', `${location.pathname}${location.search}#/order`);
    }
    if (!location.hash) history.replaceState(null, '', session()?.role === 'Barista' ? '#/barista' : '#/order');
    render();
    if (cloudEnabled()) {
      try {
        await syncCatalogFromCloud();
        if (session()?.accessToken) await syncOrdersFromCloud();
        render();
      } catch (err) { console.warn('Shared database sync failed:', err); }
      startCloudPolling();
    }
  }

  bootstrap();
})();
