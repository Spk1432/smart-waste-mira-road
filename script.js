/* ═══════════════════════════════════════════════════
   SWMS — Mira Road | script.js
   Smart Waste Management System
   Handles: Auth, Navigation, Map, Complaints, Reports
═══════════════════════════════════════════════════ */

'use strict';

/* ── CONFIG & DATA ───────────────────────────────── */
const MAP_CENTER = { lat: 19.2813, lng: 72.8542 };
const MAP_ZOOM   = 13;

const BINS_DATA = [
  { id: 'MR-01', zone: 'Mira Road East',  area: 'Jangid Complex', lat: 19.2890, lng: 72.8710, fill: 91 },
  { id: 'MR-02', zone: 'Mira Road West',  area: 'Sector 3',       lat: 19.2870, lng: 72.8540, fill: 63 },
  { id: 'MR-03', zone: 'Bhayandar East',  area: 'Golden Nest',    lat: 19.3055, lng: 72.8760, fill: 28 },
  { id: 'MR-04', zone: 'Bhayandar West',  area: 'Silver Park',    lat: 19.3030, lng: 72.8555, fill: 77 },
  { id: 'MR-05', zone: 'Kashimira',       area: 'Nav Nagar',      lat: 19.2720, lng: 72.8680, fill: 14 },
  { id: 'MR-06', zone: 'Shanti Nagar',    area: 'Navghar',        lat: 19.2810, lng: 72.8630, fill: 53 },
  { id: 'MR-07', zone: 'Uttan Road',      area: 'Uttan Village',  lat: 19.3220, lng: 72.8290, fill: 85 },
  { id: 'MR-08', zone: 'Murdhe Village',  area: 'Near Station',   lat: 19.2750, lng: 72.8720, fill: 40 },
];

const DEMO_USERS = [
  { id: 1, name: 'Rahul Sharma',  email: 'user@demo.com',       pw: 'demo123', role: 'citizen'  },
  { id: 2, name: 'MBMC Officer',  email: 'officer@mbmc.gov.in', pw: 'mbmc123', role: 'employee' },
];

const SAMPLE_COMPLAINTS = [
  { id: 'C001', issue: 'Overflowing Dustbin',    zone: 'Mira Road East',  desc: 'Near Jangid Complex gate, overflowing since morning.', time: '1h ago',    status: 'Pending',     uid: 1, uname: 'Rahul Sharma', img: null },
  { id: 'C002', issue: 'Garbage Not Collected',  zone: 'Bhayandar West',  desc: 'Silver Park area — 3 days no collection.',            time: '4h ago',    status: 'In Progress', uid: 1, uname: 'Rahul Sharma', img: null },
  { id: 'C003', issue: 'Illegal Dumping',        zone: 'Uttan Road',      desc: 'Large pile near Gorai link road junction.',           time: 'Yesterday', status: 'Resolved',    uid: 1, uname: 'Rahul Sharma', img: null },
  { id: 'C004', issue: 'Damaged Bin',            zone: 'Bhayandar West',  desc: 'Silver Park main gate bin lid is broken.',            time: '2d ago',    status: 'Pending',     uid: 1, uname: 'Rahul Sharma', img: null },
];

const STATUS_NEXT  = { 'Pending': 'In Progress', 'In Progress': 'Resolved' };
const ISSUE_TYPES  = ['Overflowing Dustbin','Garbage Not Collected','Illegal Dumping','Damaged Bin','Bad Smell / Unhygienic','Stray Animals Near Waste','Other'];
const MAP_TYPES    = ['roadmap', 'satellite', 'hybrid'];

/* ── APP STATE ───────────────────────────────────── */
const S = {
  users:     JSON.parse(localStorage.getItem('swms_users'))    || DEMO_USERS.map(u => ({ ...u })),
  comps:     JSON.parse(localStorage.getItem('swms_comps'))    || SAMPLE_COMPLAINTS.map(c => ({ ...c })),
  me:        null,
  bins:      BINS_DATA.map(b => ({ ...b })),
  dark:      false,
  notif:     true,
  balert:    true,
  page:      null,
  sbOpen:    true,
  regRole:   'citizen',
  upImg:     null,
  upName:    '',
  activeFilter: 'All',
  expanded:  null,
  // Map state
  gmap:      null,
  markers:   {},
  mapType:   'roadmap',
  selBin:    null,
  mapReady:  false,
};

/* ── HELPERS ─────────────────────────────────────── */
function save() {
  localStorage.setItem('swms_users', JSON.stringify(S.users));
  localStorage.setItem('swms_comps', JSON.stringify(S.comps));
}
const isEmp   = () => S.me?.role === 'employee';
const accColor = () => isEmp() ? '#1d4ed8' : '#16a34a';

function binColor(fill) {
  if (fill >= 80) return '#ef4444';
  if (fill >= 60) return '#f97316';
  if (fill >= 40) return '#f59e0b';
  return '#22c55e';
}
function binBadgeClass(fill) {
  if (fill >= 80) return 'badge-critical';
  if (fill >= 60) return 'badge-high';
  if (fill >= 40) return 'badge-moderate';
  return 'badge-ok';
}
function statusBadge(status) {
  const cls = { 'Pending': 'badge-pending', 'In Progress': 'badge-inprogress', 'Resolved': 'badge-resolved' };
  return `<span class="badge ${cls[status] || 'badge-pending'}">${status}</span>`;
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── TOAST ───────────────────────────────────────── */
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast-msg toast-${type}`;
  el.textContent = msg;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2700);
  setTimeout(() => el.remove(), 3000);
}

/* ════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════ */
let authMode = 'login';

function switchTab(mode) {
  authMode = mode;
  document.getElementById('tab-login').classList.toggle('on', mode === 'login');
  document.getElementById('tab-register').classList.toggle('on', mode === 'register');
  document.getElementById('login-form').style.display    = mode === 'login'    ? '' : 'none';
  document.getElementById('register-form').style.display = mode === 'register' ? '' : 'none';
  hideErr();
}

function pickRole(r) {
  S.regRole = r;
  document.getElementById('role-citizen').classList.toggle('on', r === 'citizen');
  document.getElementById('role-employee').classList.toggle('on', r === 'employee');
}

function showErr(msg) {
  const el = document.getElementById('auth-err');
  el.textContent = '⚠️ ' + msg;
  el.style.display = 'block';
}
function hideErr() {
  document.getElementById('auth-err').style.display = 'none';
}

function doLogin() {
  hideErr();
  const email = document.getElementById('li-email').value.trim().toLowerCase();
  const pw    = document.getElementById('li-pass').value;
  if (!email || !pw) { showErr('Please fill in all fields.'); return; }
  const user = S.users.find(u => u.email.toLowerCase() === email && u.pw === pw);
  if (!user) { showErr('Invalid email or password. Check the demo credentials below.'); return; }
  S.me = user;
  launchApp();
}

function doRegister() {
  hideErr();
  const name  = document.getElementById('rg-name').value.trim();
  const email = document.getElementById('rg-email').value.trim().toLowerCase();
  const pw    = document.getElementById('rg-pass').value;
  if (!name || !email || !pw) { showErr('All fields are required.'); return; }
  if (pw.length < 6) { showErr('Password must be at least 6 characters.'); return; }
  if (S.users.find(u => u.email.toLowerCase() === email)) { showErr('Email already registered. Please sign in.'); return; }
  const newUser = { id: Date.now(), name, email, pw, role: S.regRole };
  S.users.push(newUser);
  S.me = newUser;
  save();
  launchApp();
}

function launchApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  buildNav();
  setAvatar();
  goTo('home');
  toast(`Welcome, ${S.me.name}! 👋`);
}

function doLogout() {
  S.me = null; S.page = null; S.selBin = null; S.expanded = null; S.activeFilter = 'All';
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'block';
  document.getElementById('li-email').value = '';
  document.getElementById('li-pass').value  = '';
  hideErr();
  toast('Logged out successfully.');
}

/* ════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════ */
function getNavItems() {
  return isEmp()
    ? [
        { id: 'home',    icon: '🏠', label: 'Home'       },
        { id: 'map',     icon: '🗺️', label: 'Bin Map'    },
        { id: 'allc',    icon: '📢', label: 'Complaints' },
        { id: 'reports', icon: '📈', label: 'Reports'    },
        { id: 'settings',icon: '⚙️', label: 'Settings'   },
      ]
    : [
        { id: 'home',       icon: '🏠', label: 'Home'       },
        { id: 'map',        icon: '🗺️', label: 'Bin Map'    },
        { id: 'complaint',  icon: '📢', label: 'Complaint'  },
        { id: 'myc',        icon: '📋', label: 'My Cases'   },
        { id: 'settings',   icon: '⚙️', label: 'Settings'   },
      ];
}

function buildNav() {
  const items = getNavItems();
  // Sidebar
  document.getElementById('sb-nav').innerHTML = items.map(x => `
    <button class="nav-item" data-page="${x.id}" onclick="goTo('${x.id}')">
      <span class="ni-icon">${x.icon}</span>
      <span class="ni-label">${x.label}</span>
    </button>`).join('');
  // Bottom nav
  document.getElementById('bottom-nav').innerHTML = items.map(x => `
    <button class="bn-item" data-page="${x.id}" onclick="goTo('${x.id}')">
      <span class="bn-icon">${x.icon}</span>
      <span class="bn-label">${x.label}</span>
    </button>`).join('');
}

function syncNav(page) {
  document.querySelectorAll('[data-page]').forEach(el => {
    const on = el.dataset.page === page;
    if (el.classList.contains('nav-item')) {
      el.classList.toggle('active', on);
    } else {
      el.classList.toggle('active', on);
      const dot = el.querySelector('.bn-dot');
      if (on && !dot)   { const d = document.createElement('div'); d.className = 'bn-dot'; el.appendChild(d); }
      if (!on && dot)   dot.remove();
    }
  });
  const label = getNavItems().find(x => x.id === page)?.label || '';
  document.getElementById('tb-page-name').textContent = label;
}

function setAvatar() {
  const av = document.getElementById('user-av');
  av.textContent = S.me.name[0].toUpperCase();
  av.style.background = isEmp()
    ? 'linear-gradient(135deg,#1d4ed8,#60a5fa)'
    : 'linear-gradient(135deg,#16a34a,#4ade80)';
}

function toggleSidebar() {
  S.sbOpen = !S.sbOpen;
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('collapsed', !S.sbOpen);
  document.getElementById('sb-toggle').textContent = S.sbOpen ? '◀' : '▶';
  sb.querySelectorAll('.sb-brand, .ni-label').forEach(e => {
    e.style.display = S.sbOpen ? '' : 'none';
  });
}

function goTo(page) {
  S.page = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('pg-' + page);
  if (pg) pg.classList.add('active');
  syncNav(page);

  switch (page) {
    case 'home':      renderHome();        break;
    case 'map':       renderMap();         break;
    case 'complaint': renderComplaint();   break;
    case 'myc':       renderMyC();         break;
    case 'allc':      renderAllC();        break;
    case 'reports':   renderReports();     break;
    case 'settings':  renderSettings();    break;
  }
}

/* ════════════════════════════════════════════════════
   GOOGLE MAP
═══════════════════════════════════════════════════ */

// Called by Google Maps API after loading (see index.html callback param)
function initGoogleMap() {
  S.mapReady = true;
  // If map page is already active, build the map immediately
  if (S.page === 'map') buildGoogleMap();
}

function renderMap() {
  // If API already loaded, build; otherwise wait (initGoogleMap will call it)
  if (S.mapReady) buildGoogleMap();
}

function buildGoogleMap() {
  if (S.gmap) {
    // Map already exists — just refresh size
    google.maps.event.trigger(S.gmap, 'resize');
    return;
  }
  S.gmap = new google.maps.Map(document.getElementById('gmap'), {
    center:    MAP_CENTER,
    zoom:      MAP_ZOOM,
    mapTypeId: S.mapType,
    fullscreenControl: true,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,   // We have our own buttons
    styles: [{featureType:'poi',stylers:[{visibility:'off'}]}],
  });
  addMapMarkers();
  renderBinList();
}

function addMapMarkers() {
  if (!S.gmap) return;
  // Clear existing
  Object.values(S.markers).forEach(m => m.setMap(null));
  S.markers = {};

  S.bins.forEach(b => {
    const color = binColor(b.fill);
    const marker = new google.maps.Marker({
      position: { lat: b.lat, lng: b.lng },
      map: S.gmap,
      title: `${b.zone} — ${b.fill}% Full`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2.5,
      },
      label: {
        text: b.fill + '%',
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: '800',
        fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
      },
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `<div style="font-family:system-ui;padding:4px 6px">
        <strong style="font-size:14px">${b.zone}</strong><br>
        <span style="color:#666;font-size:12px">${b.area}</span><br>
        <span style="color:${color};font-weight:800;font-size:16px">${b.fill}% Full</span>
      </div>`,
    });

    marker.addListener('click', () => {
      infoWindow.open(S.gmap, marker);
      selectBin(b.id);
    });

    S.markers[b.id] = marker;
  });
}

function setMapType(type) {
  S.mapType = type;
  if (S.gmap) S.gmap.setMapTypeId(type);
  document.querySelectorAll('.mtype-btn').forEach(btn => btn.classList.remove('active'));
  const ids = { roadmap: 'btn-road', satellite: 'btn-satellite', hybrid: 'btn-hybrid' };
  const el = document.getElementById(ids[type]);
  if (el) el.classList.add('active');
}

function selectBin(id) {
  S.selBin = id;
  const b = S.bins.find(x => x.id === id);
  if (!b) return;

  const color = binColor(b.fill);
  const label = b.fill >= 80 ? 'CRITICAL' : b.fill >= 60 ? 'HIGH' : b.fill >= 40 ? 'MODERATE' : 'OK';

  const dispatchBtn = isEmp() && b.fill > 40
    ? `<button class="btn btn-g btn-full" style="margin-top:12px" onclick="dispatchTruck('${b.id}')">🚛 Dispatch Truck to ${esc(b.zone)}</button>`
    : isEmp()
      ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;font-size:12px;color:#166534;margin-top:10px">✅ This bin is in good condition — no dispatch needed.</div>`
      : b.fill > 80
        ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 12px;font-size:12px;color:#9a3412;margin-top:10px">⚠️ Critical! MBMC has been notified automatically.</div>`
        : '';

  document.getElementById('bin-detail-box').innerHTML = `
    <div class="card bin-detail-card" style="border-color:${color}">
      <div style="font-size:30px;margin-bottom:8px">🗑️</div>
      <div class="bin-det-zone">${esc(b.zone)}</div>
      <div class="bin-det-sub">${esc(b.area)} · ${b.id}</div>
      <div class="bin-det-bar-wrap">
        <div class="bin-det-bar-lbl">Fill Level</div>
        <div class="fill-bar"><div class="fill-bar-inner" style="width:${b.fill}%;background:${color}"></div></div>
        <div class="bin-det-pct" style="color:${color}">${b.fill}%</div>
      </div>
      <span class="badge ${binBadgeClass(b.fill)}">${label}</span>
      ${dispatchBtn}
    </div>`;

  renderBinList();
  if (S.gmap) S.gmap.panTo({ lat: b.lat, lng: b.lng });
}

function dispatchTruck(binId) {
  const b = S.bins.find(x => x.id === binId);
  if (!b) return;
  b.fill = Math.max(0, b.fill - 78);
  addMapMarkers();      // refresh markers
  selectBin(binId);     // update detail panel
  renderBinList();
  toast(`🚛 Truck dispatched to ${b.zone}! Bin level reduced.`);
  if (S.page === 'home') renderHome();
}

function renderBinList() {
  const el = document.getElementById('bin-list');
  if (!el) return;
  el.innerHTML = S.bins.map(b => {
    const c = binColor(b.fill);
    return `<div class="bin-list-row${b.id === S.selBin ? ' selected' : ''}" onclick="selectBin('${b.id}')">
      <div class="bin-dot" style="background:${c}"></div>
      <div class="bin-name">${esc(b.zone)}</div>
      <div class="bin-pct" style="color:${c}">${b.fill}%</div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════ */
function renderHome() {
  isEmp() ? renderEmpHome() : renderCitizenHome();
}

function renderCitizenHome() {
  const mine  = S.comps.filter(c => c.uid === S.me.id);
  const crit  = S.bins.filter(b => b.fill >= 80);

  const critHtml = crit.length ? `
    <div class="crit-box">
      <div class="crit-title">🚨 Critical Bins Near You</div>
      ${crit.map(b => `
        <div class="crit-row">
          <div><div class="crit-zone">${esc(b.zone)}</div><div class="crit-area">${esc(b.area)}</div></div>
          <div class="crit-pct">${b.fill}%</div>
        </div>`).join('')}
      <button class="btn btn-r btn-sm" onclick="goTo('complaint')" style="margin-top:12px">📢 Report This Issue</button>
    </div>` : '';

  const recentHtml = mine.length === 0
    ? `<div class="card empty-state"><div class="ei">📭</div>No complaints yet. <button class="link-btn" onclick="goTo('complaint')">File your first →</button></div>`
    : `<div class="card card-0">${mine.slice(0, 4).map((c, i, a) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:${i < a.length-1 ? '1px solid var(--brd)' : 'none'};flex-wrap:wrap;gap:8px">
          <div><div style="font-size:13px;font-weight:700">${esc(c.issue)}</div><div style="font-size:11px;color:var(--mut);margin-top:3px">${esc(c.zone)} · ${c.time}</div></div>
          ${statusBadge(c.status)}
        </div>`).join('')}
       </div>`;

  document.getElementById('pg-home').innerHTML = `
    <div class="hero-green">
      <div class="hero-orb"></div>
      <div style="position:relative;z-index:1">
        <span class="hero-tag hero-tag-g">CITIZEN PORTAL</span>
        <h1 class="hero-title" style="color:#14532d">Hi, ${esc(S.me.name)}! 👋</h1>
        <p class="hero-desc" style="color:#166534">Mira-Bhayandar Resident · Track waste, file complaints, stay informed.</p>
        <div class="hero-btns">
          <button class="btn btn-g" onclick="goTo('complaint')">📢 File a Complaint</button>
          <button class="btn btn-og" onclick="goTo('map')">🗺️ View Bin Map</button>
        </div>
      </div>
    </div>
    <div class="pp">
      <div class="grid-3" style="margin-bottom:22px">
        ${[
          { i:'📢', l:'Total Filed',  v: mine.length,                                   s:'Complaints filed',  a: false },
          { i:'⏳', l:'Pending',      v: mine.filter(c=>c.status==='Pending').length,   s:'Awaiting action',   a: true  },
          { i:'✅', l:'Resolved',     v: mine.filter(c=>c.status==='Resolved').length,  s:'Completed',         a: false },
        ].map(x => `
          <div class="stat-card${x.a && x.v > 0 ? ' alert' : ''}">
            <div class="st-icon">${x.i}</div>
            <div class="st-val">${x.v}</div>
            <div class="st-label">${x.l}</div>
            <div class="st-sub">${x.s}</div>
          </div>`).join('')}
      </div>
      ${critHtml}
      <div class="sec-hdr">
        <div class="sec-title">My Recent Complaints</div>
        <button class="link-btn" onclick="goTo('myc')">See All →</button>
      </div>
      ${recentHtml}
    </div>`;
}

function renderEmpHome() {
  const crit = S.bins.filter(b => b.fill >= 80);
  const pend = S.comps.filter(c => c.status === 'Pending');
  const resl = S.comps.filter(c => c.status === 'Resolved');

  const critHtml = crit.length ? `
    <h3 class="sec-title">🚨 Critical Bins — Dispatch Required</h3>
    ${crit.map(b => `
      <div class="card card-red" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-weight:800;font-size:14px">${esc(b.zone)} · ${esc(b.area)}</div>
            <div style="font-size:12px;color:#dc2626;font-weight:700;margin-top:3px">🚨 ${b.fill}% Full · ${b.id}</div>
          </div>
          <button class="btn btn-g btn-sm" onclick="quickDispatch('${b.id}')">🚛 Dispatch Truck</button>
        </div>
        <div class="fill-bar" style="margin-top:12px">
          <div class="fill-bar-inner" style="width:${b.fill}%;background:#ef4444"></div>
        </div>
      </div>`).join('')}
    <div style="margin-bottom:22px"></div>` : '';

  document.getElementById('pg-home').innerHTML = `
    <div class="hero-blue">
      <span class="hero-tag hero-tag-b">EMPLOYEE DASHBOARD</span>
      <h1 class="hero-title" style="color:#1e3a8a">Welcome, ${esc(S.me.name)} 🏢</h1>
      <p class="hero-desc" style="color:#1e40af">MBMC Operations · Mira-Bhayandar Municipal Corporation</p>
      <div class="hero-btns">
        <button class="btn btn-b" onclick="goTo('map')">🗺️ Open Dispatch Map</button>
        <button class="btn btn-ob" onclick="goTo('allc')">📢 Manage Complaints</button>
      </div>
    </div>
    <div class="pp">
      <div class="grid-4" style="margin-bottom:24px">
        ${[
          { i:'🗑️', l:'Total Bins',    v: S.bins.length, s:'All zones',        a: false },
          { i:'🚨', l:'Critical',      v: crit.length,   s:'Need dispatch',    a: crit.length > 0 },
          { i:'📢', l:'Pending',       v: pend.length,   s:'Open complaints',  a: pend.length > 0 },
          { i:'✅', l:'Resolved',      v: resl.length,   s:'All time',         a: false },
        ].map(x => `
          <div class="stat-card${x.a && x.v > 0 ? ' alert' : ''}">
            <div class="st-icon">${x.i}</div>
            <div class="st-val">${x.v}</div>
            <div class="st-label">${x.l}</div>
            <div class="st-sub">${x.s}</div>
          </div>`).join('')}
      </div>
      ${critHtml}
      <div class="sec-hdr">
        <div class="sec-title">📋 Pending Complaints</div>
        <button class="link-btn blue" onclick="goTo('allc')">Manage All →</button>
      </div>
      <div class="card card-0">
        ${pend.length === 0
          ? '<div class="empty-state">✅ No pending complaints right now.</div>'
          : pend.slice(0,4).map((c,i,a) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:${i<a.length-1?'1px solid var(--brd)':'none'};flex-wrap:wrap;gap:8px">
              <div><div style="font-size:13px;font-weight:700">${esc(c.issue)}</div><div style="font-size:11px;color:var(--mut);margin-top:2px">${esc(c.zone)} · ${c.time} · By ${esc(c.uname)}</div></div>
              ${statusBadge(c.status)}
            </div>`).join('')}
      </div>
    </div>`;
}

function quickDispatch(id) {
  dispatchTruck(id);
  renderHome();
}

/* ════════════════════════════════════════════════════
   COMPLAINT FORM
═══════════════════════════════════════════════════ */
function renderComplaint() {
  S.upImg = null; S.upName = '';
  document.getElementById('pg-complaint').innerHTML = `
    <div class="pp">
      <h2 class="page-title">File a Complaint</h2>
      <p class="page-sub" style="margin-bottom:22px">Report any waste issue in Mira Road area</p>
      <div style="max-width:600px">
        <div class="card">
          <div class="fg">
            <label>Issue Type *</label>
            <select id="ci-issue">
              <option value="">Select issue type...</option>
              ${ISSUE_TYPES.map(o => `<option>${esc(o)}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <label>Zone / Area *</label>
            <select id="ci-zone">
              <option value="">Select zone...</option>
              ${S.bins.map(b => `<option>${esc(b.zone)}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <label>Description <span class="optional">(optional)</span></label>
            <textarea id="ci-desc" placeholder="Exact location, severity, how long it's been like this..."></textarea>
          </div>
          <div class="fg">
            <label>Upload Photo <span class="optional">(optional · JPG/PNG · max 5MB)</span></label>
            <input type="file" id="ci-file" accept="image/*" style="display:none" onchange="handleImg(this)" />
            <button class="upload-zone" onclick="document.getElementById('ci-file').click()">
              📷 <span id="up-lbl">Click to upload image</span>
            </button>
            <div id="up-preview" style="display:none;position:relative;display:none">
              <img id="up-img" class="preview-img" src="" alt="Preview" />
              <button class="rm-img-btn" onclick="removeImg()">×</button>
              <div id="up-fname" style="font-size:11px;color:var(--mut);margin-top:4px"></div>
            </div>
          </div>
          <button class="btn btn-g btn-full btn-lg" onclick="submitComplaint()">🚀 Submit Complaint</button>
        </div>
      </div>
    </div>`;
}

function handleImg(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Image too large (max 5MB)', 'er'); return; }
  S.upName = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    S.upImg = e.target.result;
    const prev = document.getElementById('up-preview');
    document.getElementById('up-img').src = e.target.result;
    document.getElementById('up-fname').textContent = '📎 ' + file.name;
    document.getElementById('up-lbl').textContent = file.name;
    prev.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function removeImg() {
  S.upImg = null; S.upName = '';
  document.getElementById('up-preview').style.display = 'none';
  document.getElementById('ci-file').value = '';
  document.getElementById('up-lbl').textContent = 'Click to upload image';
}

function submitComplaint() {
  const issue = document.getElementById('ci-issue').value;
  const zone  = document.getElementById('ci-zone').value;
  const desc  = document.getElementById('ci-desc').value.trim();
  if (!issue) { toast('Please select an issue type', 'er'); return; }
  if (!zone)  { toast('Please select a zone', 'er'); return; }

  const id = 'C' + String(S.comps.length + 1).padStart(3, '0');
  S.comps.unshift({ id, issue, zone, desc, uid: S.me.id, uname: S.me.name, time: 'Just now', status: 'Pending', img: S.upImg });
  save();
  toast('✅ Complaint submitted successfully!');

  document.getElementById('pg-complaint').innerHTML = `
    <div class="pp">
      <div class="card" style="max-width:600px;text-align:center;padding:44px 24px">
        <div style="font-size:52px;margin-bottom:14px">✅</div>
        <div style="font-weight:800;font-size:22px;color:#16a34a">Complaint Submitted!</div>
        <div style="color:var(--sub);font-size:14px;margin-top:8px;line-height:1.6">
          Reference ID: <strong>#${id}</strong><br>
          MBMC will respond within 24 hours.
        </div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:22px">
          <button class="btn btn-g" onclick="renderComplaint()">+ File Another</button>
          <button class="btn btn-og" onclick="goTo('myc')">📋 View My Complaints</button>
        </div>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════════
   CASE LISTS
═══════════════════════════════════════════════════ */
function renderMyC() {
  const mine = S.comps.filter(c => c.uid === S.me.id);
  renderCaseList('pg-myc', mine, false, 'My Complaints', `${mine.length} total complaints`, 'g');
}

function renderAllC() {
  renderCaseList('pg-allc', S.comps, true, 'All Complaints', 'Review and update complaint statuses', 'b');
}

function renderCaseList(pgId, list, isAdmin, title, sub, fc) {
  const f = S.activeFilter;
  const filtered = f === 'All' ? list : list.filter(c => c.status === f);
  const counts = { All: list.length, Pending: list.filter(c=>c.status==='Pending').length, 'In Progress': list.filter(c=>c.status==='In Progress').length, Resolved: list.filter(c=>c.status==='Resolved').length };

  document.getElementById(pgId).innerHTML = `
    <div class="pp">
      <h2 class="page-title">${title}</h2>
      <p class="page-sub" style="margin-bottom:16px">${sub}</p>
      <div class="filter-row">
        ${['All','Pending','In Progress','Resolved'].map(x => `
          <button class="filter-btn${x === f ? ` active-${fc}` : ''}"
                  onclick="setFilter('${x}','${pgId}',${isAdmin})">
            ${x} (${counts[x]})
          </button>`).join('')}
      </div>
      ${filtered.length === 0
        ? `<div class="card empty-state"><div class="ei">📭</div>No complaints in this category.</div>`
        : `<div class="cc-wrap">${filtered.map(c => complaintCardHtml(c, isAdmin)).join('')}</div>`}
    </div>`;
}

function setFilter(f, pgId, isAdmin) {
  S.activeFilter = f; S.expanded = null;
  if (pgId === 'pg-myc') renderMyC(); else renderAllC();
}

function complaintCardHtml(c, isAdmin) {
  const ex  = S.expanded === c.id;
  const nx  = STATUS_NEXT[c.status];
  const actBtn = isAdmin && nx
    ? `<button class="btn btn-b btn-sm" onclick="updateStatus('${c.id}')">→ Mark ${esc(nx)}</button>`
    : '';
  const descHtml = ex && c.desc
    ? `<div class="cc-desc">${esc(c.desc)}</div>` : '';
  const imgHtml = ex && c.img
    ? `<img src="${c.img}" class="preview-img" style="margin-top:10px" alt="Evidence photo" />` : '';

  return `
    <div class="complaint-card">
      <div class="cc-head">
        <div style="flex:1">
          <div class="cc-title">${esc(c.issue)}</div>
          <div class="cc-meta">${esc(c.zone)} · ${c.time}${isAdmin ? ' · By ' + esc(c.uname) : ''}</div>
          ${descHtml}${imgHtml}
        </div>
        <div class="cc-right">
          ${statusBadge(c.status)}
          ${actBtn}
        </div>
      </div>
      <div class="cc-foot">
        <div class="cc-id">ID: #${c.id}</div>
        <button class="exp-btn" onclick="toggleExpand('${c.id}',${isAdmin})">
          ${ex ? '▲ Collapse' : '▼ Details & Photo'}
        </button>
      </div>
    </div>`;
}

function toggleExpand(id, isAdmin) {
  S.expanded = S.expanded === id ? null : id;
  if (isAdmin) renderAllC(); else renderMyC();
}

function updateStatus(id) {
  const c = S.comps.find(x => x.id === id);
  if (!c || !STATUS_NEXT[c.status]) return;
  c.status = STATUS_NEXT[c.status];
  save();
  toast(`✅ #${c.id} marked as ${c.status}`);
  renderAllC();
  if (S.page === 'home') renderHome();
}

/* ════════════════════════════════════════════════════
   REPORTS
═══════════════════════════════════════════════════ */
function renderReports() {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const vals = [38, 55, 50, 72, 85, 40, 25];
  const maxV = Math.max(...vals);
  const resolvedPct = Math.round(S.comps.filter(c=>c.status==='Resolved').length / Math.max(S.comps.length,1) * 100);

  document.getElementById('pg-reports').innerHTML = `
    <div class="pp">
      <h2 class="page-title">Reports & Analytics</h2>
      <p class="page-sub" style="margin-bottom:22px">Mira Road · Weekly performance overview</p>

      <div class="card" style="margin-bottom:18px">
        <div class="sec-title">📊 Weekly Waste Collection (Tonnes)</div>
        <div class="bar-chart">
          ${days.map((d,i) => {
            const h = Math.round(vals[i] / maxV * 110);
            const peak = vals[i] === maxV;
            return `
              <div class="bar-col">
                <div class="bar-val">${vals[i]}</div>
                <div class="bar-bar" style="height:${h}px;background:${peak
                  ? 'linear-gradient(180deg,#16a34a,#22c55e)'
                  : 'linear-gradient(180deg,#86efac,#bbf7d0)'}"></div>
                <div class="bar-lbl">${d}</div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <div class="grid-3">
        ${[
          { l:'Total Collected',   v:'365 T',          i:'🗑️', c:'+12%', p:true  },
          { l:'Avg per Day',       v:'52.1 T',          i:'📦', c:'+5%',  p:true  },
          { l:'Resolution Rate',   v:resolvedPct+'%',   i:'✅', c:'+4%',  p:true  },
          { l:'Trucks Utilised',   v:'6 / 8',           i:'🚛', c:'-1',   p:false },
          { l:'Zones Covered',     v:'8 / 8',           i:'🗺️', c:'100%', p:true  },
          { l:'Avg Response',      v:'2.1 hrs',         i:'⏱️', c:'-22m', p:true  },
        ].map(x => `
          <div class="stat-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <span style="font-size:22px">${x.i}</span>
              <span style="font-size:10px;font-weight:800;color:${x.p?'#16a34a':'#dc2626'};background:${x.p?'#f0fdf4':'#fff1f2'};padding:2px 8px;border-radius:20px">${x.c}</span>
            </div>
            <div class="st-val" style="font-size:22px;margin-top:10px">${x.v}</div>
            <div class="st-label" style="margin-top:3px">${x.l}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════ */
function renderSettings() {
  const emp   = isEmp();
  const avBg  = emp ? 'linear-gradient(135deg,#1d4ed8,#60a5fa)' : 'linear-gradient(135deg,#16a34a,#4ade80)';
  const rClr  = emp ? '#1d4ed8' : '#16a34a';

  document.getElementById('pg-settings').innerHTML = `
    <div class="pp">
      <h2 class="page-title">Settings</h2>
      <p class="page-sub" style="margin-bottom:22px">Manage your account & preferences</p>
      <div style="max-width:520px;display:flex;flex-direction:column;gap:14px">

        <div class="card">
          <div class="sec-title" style="margin-bottom:16px">👤 Profile</div>
          <div class="profile-row">
            <div class="profile-av" style="background:${avBg}">${esc(S.me.name[0].toUpperCase())}</div>
            <div>
              <div class="profile-name">${esc(S.me.name)}</div>
              <div class="profile-email">${esc(S.me.email)}</div>
              <div class="profile-role" style="color:${rClr}">${emp ? '🏢 MBMC Employee' : '👤 Citizen'}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="sec-title" style="margin-bottom:14px">⚙️ Preferences</div>
          ${[
            { id:'tog-notif',  lbl:'Push Notifications',  sub:'Enable browser alerts',       on: S.notif,  fn:"togglePref('notif','tog-notif')"  },
            { id:'tog-balert', lbl:'Critical Bin Alerts',  sub:'Alert when bin exceeds 80%',  on: S.balert, fn:"togglePref('balert','tog-balert')" },
            { id:'tog-dark',   lbl:'Dark Mode',             sub:'Switch to dark theme',        on: S.dark,   fn:'toggleDark()'                      },
          ].map(x => `
            <div class="pref-row">
              <div>
                <div class="pref-label">${x.lbl}</div>
                <div class="pref-sub">${x.sub}</div>
              </div>
              <button id="${x.id}" class="toggle ${x.on ? 'on' : 'off'}" onclick="${x.fn}">
                <div class="toggle-knob"></div>
              </button>
            </div>`).join('')}
        </div>

        <button class="btn btn-ghost-r btn-full btn-lg" onclick="doLogout()">🚪 Logout from SWMS</button>
      </div>
    </div>`;
}

function togglePref(key, elId) {
  S[key] = !S[key];
  const btn = document.getElementById(elId);
  if (btn) { btn.classList.toggle('on', S[key]); btn.classList.toggle('off', !S[key]); }
}

function toggleDark() {
  S.dark = !S.dark;
  document.body.classList.toggle('dark', S.dark);
  const btn = document.getElementById('tog-dark');
  if (btn) { btn.classList.toggle('on', S.dark); btn.classList.toggle('off', !S.dark); }
}

/* ════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('li-email');
  if (emailInput) emailInput.focus();
});
