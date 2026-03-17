import { getDashboardStyles } from './dashboard-styles';
import { getDashboardScripts } from './dashboard-scripts';

/** Renders the admin dashboard as a self-contained HTML page. */
export function renderDashboard(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BinMate Admin</title>
<style>${getDashboardStyles()}</style>
</head>
<body>
<header>
  <div class="dot"></div>
  <h1>BinMate Admin</h1>
  <span class="meta">Internal use only · <a href="/api/v1/health">API health</a></span>
</header>
<nav>
  <button class="tab-btn" data-tab="overview"  onclick="showTab('overview')">Overview</button>
  <button class="tab-btn" data-tab="councils"  onclick="showTab('councils')">Councils</button>
  <button class="tab-btn" data-tab="zones"     onclick="showTab('zones')">Zones</button>
  <button class="tab-btn" data-tab="holidays"  onclick="showTab('holidays')">Holidays</button>
  <button class="tab-btn" data-tab="users"     onclick="showTab('users')">Users</button>
  <button class="tab-btn" data-tab="cache"     onclick="showTab('cache')">Cache</button>
  <button class="tab-btn" data-tab="system"    onclick="showTab('system')">System</button>
</nav>

<!-- Overview -->
<div class="page" id="page-overview">
  <div class="stats">
    <div class="card"><div class="val" id="ov-councils">…</div><div class="lbl">Councils</div><div class="sub" id="ov-councils-sub"></div></div>
    <div class="card"><div class="val" id="ov-zones">…</div><div class="lbl">Zones</div></div>
    <div class="card"><div class="val" id="ov-users">…</div><div class="lbl">Users</div><div class="sub" id="ov-users-sub"></div></div>
    <div class="card"><div class="val" id="ov-holidays">…</div><div class="lbl">Holidays</div></div>
    <div class="card"><div class="val" id="ov-cache">…</div><div class="lbl">Cached addresses</div></div>
  </div>
  <div class="panel">
    <div class="panel-row"><h2>Top zones by users</h2></div>
    <table>
      <thead><tr><th>Zone</th><th>Council</th><th>Users</th></tr></thead>
      <tbody id="ov-top-zones"><tr><td colspan="3" class="dim">Loading…</td></tr></tbody>
    </table>
  </div>
  <div class="sb" id="ov-status">Loading…</div>
</div>

<!-- Councils -->
<div class="page" id="page-councils">
  <div class="panel">
    <div class="panel-row">
      <h2>Operations</h2>
      <div class="row">
        <button class="btn p" id="run-all-btn" onclick="runAllScrapers()">Run all scrapers</button>
      </div>
    </div>
    <div class="sb" id="councils-status">Select a council action below.</div>
  </div>
  <table>
    <thead><tr><th>Council</th><th>Platform</th><th>Zones</th><th>Last scraped</th><th>Status</th><th>Health</th><th>Actions</th></tr></thead>
    <tbody id="councils-tbody"><tr><td colspan="7" class="dim">Loading…</td></tr></tbody>
  </table>
</div>

<!-- Zones -->
<div class="page" id="page-zones">
  <div class="filters">
    <input id="zones-council-filter" placeholder="Filter by council slug…" style="width:240px"
      oninput="filterZones(this.value)">
    <button class="btn" onclick="filterZones(document.getElementById('zones-council-filter').value)">Filter</button>
  </div>
  <table>
    <thead><tr><th>Zone</th><th>Council</th><th>General</th><th>Recycling</th><th>Green waste</th><th>Users</th><th>Updated</th></tr></thead>
    <tbody id="zones-tbody"><tr><td colspan="7" class="dim">Loading…</td></tr></tbody>
  </table>
</div>

<!-- Holidays -->
<div class="page" id="page-holidays">
  <table>
    <thead><tr><th>Name</th><th>Date</th><th>Shift</th><th>Actions</th></tr></thead>
    <tbody id="holidays-tbody"><tr><td colspan="4" class="dim">Loading…</td></tr></tbody>
  </table>
  <div class="form-row">
    <div class="fg"><label>Name</label><input id="new-hname" placeholder="Easter Monday"></div>
    <div class="fg"><label>Date</label><input id="new-hdate" type="date"></div>
    <button class="btn p" onclick="addHoliday()">Add holiday</button>
  </div>
</div>

<!-- Users -->
<div class="page" id="page-users">
  <div class="filters">
    <select id="users-status-filter" onchange="loadUsers()">
      <option value="">All statuses</option>
      <option value="free">Free</option>
      <option value="trial">Trial</option>
      <option value="active">Active</option>
      <option value="expired">Expired</option>
    </select>
  </div>
  <table>
    <thead><tr><th>ID</th><th>Created</th><th>Status</th><th>Notif. hour</th><th>Zones</th><th>Push token</th></tr></thead>
    <tbody id="users-tbody"><tr><td colspan="6" class="dim">Loading…</td></tr></tbody>
  </table>
</div>

<!-- Cache -->
<div class="page" id="page-cache">
  <div class="filters">
    <input id="cache-search" placeholder="Search addresses…" style="width:280px"
      oninput="searchCache(this.value)">
    <span class="dim" id="cache-count"></span>
    <button class="btn d" onclick="clearCache()">Clear all cache</button>
  </div>
  <table>
    <thead><tr><th>Address</th><th>Council</th><th>Zone</th><th>Cached</th><th>Expires</th></tr></thead>
    <tbody id="cache-tbody"><tr><td colspan="5" class="dim">Loading…</td></tr></tbody>
  </table>
</div>

<!-- System -->
<div class="page" id="page-system">
  <div class="stats">
    <div class="card"><div class="val sm" id="sys-db-val">…</div><div class="lbl">Database</div></div>
    <div class="card"><div class="val sm" id="sys-env-val">…</div><div class="lbl">Environment</div></div>
    <div class="card"><div class="val sm" id="sys-sha-val" style="font-size:13px;word-break:break-all">…</div><div class="lbl">Git SHA</div></div>
    <div class="card"><div class="val sm" id="sys-auth-val">…</div><div class="lbl">Admin auth</div></div>
  </div>
  <div class="panel">
    <div class="panel-row">
      <h2>Notification engine</h2>
      <button class="btn d" id="notif-btn" onclick="triggerNotifications()">Trigger notifications</button>
    </div>
    <p class="dim" style="font-size:13px">Runs nightly at 17:00 AWST. In production, sends <code>X-Admin-Confirm: RUN_NOW</code> automatically.</p>
  </div>
  <div class="sb" id="sys-status">Loading system info…</div>
</div>

<script>${getDashboardScripts()}</script>
</body>
</html>`;
}
