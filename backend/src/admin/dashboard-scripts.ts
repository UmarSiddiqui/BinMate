/** Returns inline client-side JavaScript for the admin dashboard. */
export function getDashboardScripts(): string {
  return `
const _loaded = {};

function showTab(name) {
  document.querySelectorAll('.tab-btn').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  if (!_loaded[name]) { _loaded[name] = true; _loadTab(name); }
}

function _loadTab(n) {
  ({overview:loadOverview,councils:loadCouncils,zones:loadZones,holidays:loadHolidays,
    users:loadUsers,cache:loadCache,system:loadSystem})[n]?.();
}

async function _api(method, url, body) {
  const opts = {method, headers:{}};
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(url, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _toast(msg, ok=true) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderLeft = '3px solid ' + (ok ? '#B8F04A' : '#E84848');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function _set(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }
function _badge(text, cls) { return '<span class="badge ' + cls + '">' + _esc(text) + '</span>'; }

function openModal(html) {
  closeModal();
  const o = document.createElement('div');
  o.className = 'ov-modal'; o.id = 'modal-overlay';
  o.innerHTML = '<div class="modal">' + html + '</div>';
  o.addEventListener('click', e => { if (e.target === o) closeModal(); });
  document.body.appendChild(o);
}
function closeModal() { document.getElementById('modal-overlay')?.remove(); }

// ── Overview ──────────────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    const {summary:s, system:sys} = await _api('GET', '/admin/api/summary');
    _set('ov-councils', s.councils.total); _set('ov-zones', s.zones.total);
    _set('ov-users', s.users.total); _set('ov-holidays', s.holidays.total); _set('ov-cache', s.addressCache.total);
    _set('ov-councils-sub', s.councils.active + ' active · ' + s.councils.withScrapers + ' with scrapers');
    _set('ov-users-sub', s.users.active + ' active · ' + s.users.trial + ' trial · ' + s.users.free + ' free');
    document.getElementById('ov-top-zones').innerHTML = s.topZones.map(z =>
      '<tr><td>' + _esc(z.zoneName) + '</td><td>' + _esc(z.councilName) + '</td><td class="r">' + z.userCount + '</td></tr>'
    ).join('');
    _set('ov-status', 'DB ' + sys.db.status + ' · ' + (sys.db.latencyMs ?? '?') + 'ms · ' + sys.deployment.env + ' · ' + sys.deployment.gitSha);
  } catch(err) { _set('ov-status', 'Error: ' + err.message); }
}

// ── Councils ──────────────────────────────────────────────────────────────────
async function loadCouncils() {
  try {
    const list = await _api('GET', '/admin/api/scrapers');
    document.getElementById('councils-tbody').innerHTML = list.map(c => '<tr id="cr-' + c.id + '">' +
      '<td><strong>' + _esc(c.name) + '</strong><br><code>' + _esc(c.slug) + '</code></td>' +
      '<td>' + _badge(c.platformType, 'muted') + '</td>' +
      '<td class="r">' + c.zoneCount + '</td>' +
      '<td class="dim">' + (c.lastScrapedAt ? new Date(c.lastScrapedAt).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : 'Never') + '</td>' +
      '<td>' + _badge(c.isActive ? 'Active' : 'Inactive', c.isActive ? 'lime' : 'red') + ' ' + _badge(c.hasScraper ? 'Live' : 'No scraper', c.hasScraper ? 'teal' : 'muted') + '</td>' +
      '<td class="hc dim">—</td>' +
      '<td><div class="row">' +
        (c.hasScraper ? '<button class="btn s" onclick="checkHealth(' + JSON.stringify(c.slug) + ',' + JSON.stringify(c.id) + ')">Health</button><button class="btn s" onclick="runOne(' + JSON.stringify(c.slug) + ')">Run</button>' : '') +
        '<button class="btn s ' + (c.isActive ? 'd' : '') + '" onclick="toggleCouncil(' + JSON.stringify(c.id) + ',' + c.isActive + ')">' + (c.isActive ? 'Disable' : 'Enable') + '</button>' +
      '</div></td></tr>'
    ).join('');
  } catch(err) { _set('councils-status', 'Error: ' + err.message); }
}

async function toggleCouncil(id, active) {
  try {
    await _api('PATCH', '/admin/api/councils/' + id + '/toggle');
    _toast(active ? 'Council disabled' : 'Council enabled'); _loaded.councils = false; loadCouncils();
  } catch(err) { _toast(err.message, false); }
}

async function checkHealth(slug, councilId) {
  const cell = document.querySelector('#cr-' + councilId + ' .hc');
  try {
    const {healthy, error} = await _api('POST', '/admin/api/scrapers/' + slug + '/health');
    if (cell) cell.innerHTML = _badge(healthy ? 'Healthy' : 'Failed' + (error ? ': '+error : ''), healthy ? 'teal' : 'red');
  } catch(err) { if (cell) cell.innerHTML = _badge(err.message, 'red'); }
}

async function runOne(slug) {
  try {
    const d = await _api('POST', '/admin/api/scrapers/' + slug + '/run');
    _toast(slug + ': ' + d.refreshed + ' zones refreshed'); _loaded.councils = false; loadCouncils();
  } catch(err) { _toast(err.message, false); }
}

async function runAllScrapers() {
  const btn = document.getElementById('run-all-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Running…'; }
  try {
    const r = await _api('POST', '/admin/api/scrapers/run-all');
    _toast('All done · ' + r.reduce((s,x) => s + x.refreshed, 0) + ' zones refreshed');
    _loaded.councils = false; loadCouncils();
  } catch(err) { _toast(err.message, false); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Run all scrapers'; } }
}

// ── Zones ─────────────────────────────────────────────────────────────────────
async function loadZones() { await filterZones(''); }
async function filterZones(slug) {
  try {
    const zones = await _api('GET', '/admin/api/zones' + (slug ? '?councilSlug=' + encodeURIComponent(slug) : ''));
    document.getElementById('zones-tbody').innerHTML = zones.map(z =>
      '<tr style="cursor:pointer" onclick="showZone(' + JSON.stringify(z.id) + ')">' +
      '<td><strong>' + _esc(z.zoneName) + '</strong>' + (z.zoneCode ? '<br><code>' + _esc(z.zoneCode) + '</code>' : '') + '</td>' +
      '<td>' + _esc(z.council.name) + '</td>' +
      '<td>' + _esc(z.generalDay) + '</td>' +
      '<td>' + _esc(z.recyclingDay) + ' · Week ' + _esc(z.recyclingWeek) + '</td>' +
      '<td>' + (z.greenWasteDay ? _esc(z.greenWasteDay) + ' · Week ' + _esc(z.greenWasteWeek) : '<span class="dim">—</span>') + '</td>' +
      '<td class="r">' + z.userCount + '</td>' +
      '<td class="dim">' + new Date(z.updatedAt).toLocaleDateString('en-AU',{day:'numeric',month:'short'}) + '</td>' +
      '</tr>'
    ).join('') || '<tr><td colspan="7" class="dim">No zones found.</td></tr>';
  } catch(err) { _toast('Zones error: ' + err.message, false); }
}

async function showZone(id) {
  try {
    const {zone:z, preview} = await _api('GET', '/admin/api/zones/' + id + '?count=10');
    const rows = (preview || []).map(c =>
      '<tr><td>' + c.date + '</td><td>' + _esc(c.types.join(', ')) + '</td><td>' + (c.isHolidayShifted ? '⚠ shifted' : '—') + '</td></tr>'
    ).join('');
    openModal(
      '<div class="modal-h"><h2>' + _esc(z.zoneName) + '</h2><button class="btn s" onclick="closeModal()">✕</button></div>' +
      '<dl><dt>Council</dt><dd>' + _esc(z.council.name) + '</dd>' +
      '<dt>Zone code</dt><dd>' + _esc(z.zoneCode || '—') + '</dd>' +
      '<dt>General</dt><dd>' + _esc(z.generalDay) + ' · ' + _esc(z.generalFrequency) + '</dd>' +
      '<dt>Recycling</dt><dd>' + _esc(z.recyclingDay) + ' · Week ' + _esc(z.recyclingWeek) + '</dd>' +
      '<dt>Green waste</dt><dd>' + (z.greenWasteDay ? _esc(z.greenWasteDay) + ' · Week ' + _esc(z.greenWasteWeek) : '—') + '</dd>' +
      '<dt>Users</dt><dd>' + z.userCount + '</dd></dl>' +
      (rows ? '<h3 style="margin-top:16px">Next collections</h3><table style="margin-top:8px"><thead><tr><th>Date</th><th>Types</th><th>Note</th></tr></thead><tbody>' + rows + '</tbody></table>' : '')
    );
  } catch(err) { _toast(err.message, false); }
}

// ── Holidays ──────────────────────────────────────────────────────────────────
async function loadHolidays() {
  try {
    const holidays = await _api('GET', '/admin/api/holidays');
    document.getElementById('holidays-tbody').innerHTML = holidays.map(h =>
      '<tr id="hr-' + h.id + '">' +
      '<td><input id="hn-' + h.id + '" value="' + _esc(h.name) + '" style="width:220px"></td>' +
      '<td><input id="hd-' + h.id + '" type="date" value="' + h.date.substring(0,10) + '"></td>' +
      '<td class="dim">+' + h.shiftDays + ' day</td>' +
      '<td><div class="row"><button class="btn s p" onclick="saveHoliday(' + JSON.stringify(h.id) + ')">Save</button>' +
      '<button class="btn s d" onclick="deleteHoliday(' + JSON.stringify(h.id) + ')">Delete</button></div></td></tr>'
    ).join('') || '<tr><td colspan="4" class="dim">No holidays.</td></tr>';
  } catch(err) { _toast('Holidays error: ' + err.message, false); }
}

async function saveHoliday(id) {
  const name = document.getElementById('hn-' + id)?.value;
  const date = document.getElementById('hd-' + id)?.value;
  try {
    await _api('PUT', '/admin/api/holidays/' + id, {name, date});
    _toast('Holiday saved');
  } catch(err) { _toast(err.message, false); }
}

async function deleteHoliday(id) {
  if (!confirm('Delete this holiday?')) return;
  try {
    await _api('DELETE', '/admin/api/holidays/' + id);
    document.getElementById('hr-' + id)?.remove();
    _toast('Deleted');
  } catch(err) { _toast(err.message, false); }
}

async function addHoliday() {
  const name = document.getElementById('new-hname')?.value?.trim();
  const date = document.getElementById('new-hdate')?.value;
  if (!name || !date) return _toast('Name and date required', false);
  try {
    await _api('POST', '/admin/api/holidays', {name, date});
    document.getElementById('new-hname').value = '';
    document.getElementById('new-hdate').value = '';
    _loaded.holidays = false; loadHolidays();
    _toast('Holiday added');
  } catch(err) { _toast(err.message, false); }
}

// ── Users ─────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const status = document.getElementById('users-status-filter')?.value || '';
  try {
    const users = await _api('GET', '/admin/api/users' + (status ? '?subscriptionStatus=' + status : ''));
    document.getElementById('users-tbody').innerHTML = users.map(u =>
      '<tr style="cursor:pointer" onclick="showUser(' + JSON.stringify(u.id) + ')">' +
      '<td><code>' + u.id.substring(0,8) + '…</code></td>' +
      '<td class="dim">' + new Date(u.createdAt).toLocaleDateString('en-AU') + '</td>' +
      '<td>' + _badge(u.subscriptionStatus, u.subscriptionStatus === 'active' ? 'lime' : u.subscriptionStatus === 'trial' ? 'teal' : 'muted') + '</td>' +
      '<td class="r">' + u.notificationHour + ':00</td>' +
      '<td class="r">' + u.zoneCount + '</td>' +
      '<td>' + _badge(u.pushTokenStatus, u.pushTokenStatus === 'configured' ? 'teal' : 'warn') + '</td></tr>'
    ).join('') || '<tr><td colspan="6" class="dim">No users found.</td></tr>';
  } catch(err) { _toast('Users error: ' + err.message, false); }
}

async function showUser(userId) {
  try {
    const u = await _api('GET', '/admin/api/users/' + userId);
    const zoneRows = u.zones.map(z =>
      '<tr><td>' + _esc(z.zoneName) + '</td><td>' + _esc(z.councilName) + '</td><td>' + (z.isPrimary ? _badge('Primary','lime') : '—') + '</td></tr>'
    ).join('');
    openModal(
      '<div class="modal-h"><h2>User</h2><button class="btn s" onclick="closeModal()">✕</button></div>' +
      '<dl><dt>ID</dt><dd><code>' + _esc(u.id) + '</code></dd>' +
      '<dt>Created</dt><dd>' + new Date(u.createdAt).toLocaleString('en-AU') + '</dd>' +
      '<dt>Status</dt><dd>' + _badge(u.subscriptionStatus, 'muted') + '</dd>' +
      '<dt>Notif. hour</dt><dd>' + u.notificationHour + ':00</dd>' +
      '<dt>Push token</dt><dd>' + _badge(u.pushTokenStatus, u.pushTokenStatus === 'configured' ? 'teal' : 'warn') + '</dd></dl>' +
      (u.zones.length ? '<h3 style="margin-top:16px">Zones</h3><table style="margin-top:8px"><thead><tr><th>Zone</th><th>Council</th><th>Primary</th></tr></thead><tbody>' + zoneRows + '</tbody></table>' : '') +
      '<div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)">' +
      '<button class="btn d s" onclick="deleteUser(' + JSON.stringify(u.id) + ')">Delete user</button></div>'
    );
  } catch(err) { _toast(err.message, false); }
}

async function deleteUser(userId) {
  if (!confirm('Soft-delete this user?')) return;
  try {
    await _api('DELETE', '/admin/api/users/' + userId);
    closeModal();
    _loaded.users = false; loadUsers();
    _toast('User deleted');
  } catch(err) { _toast(err.message, false); }
}

// ── Cache ─────────────────────────────────────────────────────────────────────
async function loadCache() { await searchCache(''); }

async function searchCache(q) {
  try {
    const entries = await _api('GET', '/admin/api/address-cache' + (q ? '?q=' + encodeURIComponent(q) : ''));
    document.getElementById('cache-tbody').innerHTML = entries.map(e =>
      '<tr><td>' + _esc(e.addressLabel) + '</td><td>' + _esc(e.councilName) + '</td><td>' + _esc(e.zoneName) + '</td>' +
      '<td class="dim">' + new Date(e.cachedAt).toLocaleDateString('en-AU') + '</td>' +
      '<td class="dim">' + new Date(e.expiresAt).toLocaleDateString('en-AU') + '</td></tr>'
    ).join('') || '<tr><td colspan="5" class="dim">No results.</td></tr>';
    _set('cache-count', entries.length + ' entries');
  } catch(err) { _toast('Cache error: ' + err.message, false); }
}

async function clearCache() {
  const count = document.getElementById('cache-count')?.textContent || '';
  if (!confirm('Clear entire address cache (' + count + ')? Re-geocoding will happen on next lookup.')) return;
  try {
    const {deleted} = await _api('DELETE', '/admin/api/address-cache');
    _toast('Cleared ' + deleted + ' entries');
    _loaded.cache = false; loadCache();
  } catch(err) { _toast(err.message, false); }
}

// ── System ────────────────────────────────────────────────────────────────────
async function loadSystem() {
  try {
    const sys = await _api('GET', '/admin/api/system/health');
    const dbOk = sys.db.status === 'ok';
    document.getElementById('sys-db-val').innerHTML = _badge(sys.db.status + (dbOk ? ' · ' + sys.db.latencyMs + 'ms' : ''), dbOk ? 'teal' : 'red');
    _set('sys-env-val', sys.deployment.env);
    _set('sys-sha-val', sys.deployment.gitSha);
    _set('sys-auth-val', sys.adminAuthEnabled ? 'enabled' : 'disabled');
    _set('sys-status', 'Service: ' + sys.deployment.serviceName);
  } catch(err) { _set('sys-status', 'Error: ' + err.message); }
}

async function triggerNotifications() {
  const btn = document.getElementById('notif-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Triggering…'; }
  try {
    await fetch('/admin/api/system/notifications/trigger', {method:'POST', headers:{'X-Admin-Confirm':'RUN_NOW'}});
    _toast('Notification job triggered');
  } catch(err) { _toast(err.message, false); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Trigger notifications'; } }
}

showTab('overview');
`;
}
