import type { CouncilStat } from './types';

/** Renders the admin dashboard as a self-contained HTML page. */
export function renderDashboard(councils: CouncilStat[]): string {
  const totalZones = councils.reduce((sum, council) => sum + council.zoneCount, 0);
  const scraperCount = councils.filter((council) => council.hasScraper).length;
  const rows = councils.map(renderCouncilRow).join('');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BinMate Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0D0F12;color:#F0F2F5;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
a{color:#B8F04A}
button{font:inherit}
header{background:#1A1D22;border-bottom:1px solid rgba(255,255,255,.07);padding:14px 24px;display:flex;align-items:center;gap:10px}
header h1{font-size:16px;font-weight:700}
.dot{width:8px;height:8px;background:#B8F04A;border-radius:50%;flex-shrink:0}
.meta{margin-left:auto;font-size:12px;color:#6B7480}
.stats,.actions{display:grid;gap:12px;padding:20px 24px}
.stats{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.actions{grid-template-columns:repeat(auto-fit,minmax(220px,1fr));padding-top:0}
.card,.panel{background:#1A1D22;border:1px solid rgba(255,255,255,.07);border-radius:12px}
.card{padding:16px 20px}
.card .val{font-size:28px;font-weight:700;color:#B8F04A}
.card .lbl{font-size:11px;color:#6B7480;margin-top:2px;text-transform:uppercase;letter-spacing:.06em}
.panel{padding:16px 20px}
.panel h2{font-size:12px;font-weight:700;margin-bottom:6px}
.panel p{color:#9BA3AD;font-size:13px}
main{padding:0 24px 40px}
h3{font-size:11px;font-weight:600;color:#6B7480;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
table{width:100%;border-collapse:collapse;background:#1A1D22;border-radius:12px;overflow:hidden}
th{text-align:left;padding:10px 14px;font-size:11px;font-weight:500;color:#6B7480;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,.07)}
td{padding:13px 14px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(255,255,255,.02)}
td.num{text-align:right;font-variant-numeric:tabular-nums}
code{font-size:11px;color:#6B7480;font-family:Menlo,monospace}
.dim{color:#6B7480}
.stack{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500}
.badge.lime{background:rgba(184,240,74,.12);color:#B8F04A}
.badge.teal{background:rgba(77,206,188,.12);color:#4DCEBC}
.badge.red{background:rgba(232,72,72,.12);color:#E84848}
.badge.muted{background:rgba(255,255,255,.07);color:#9BA3AD}
.badge.ok{background:rgba(77,206,188,.12);color:#4DCEBC}
.badge.fail{background:rgba(232,72,72,.12);color:#E84848}
.btn{background:rgba(255,255,255,.07);color:#F0F2F5;border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:7px 12px;font-size:12px;cursor:pointer}
.btn:hover{background:rgba(255,255,255,.12)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn.primary{background:#B8F04A;color:#0D0F12;border-color:#B8F04A}
.btn.primary:hover{background:#c7f567}
.mono{font-family:Menlo,monospace;font-size:12px}
@media (max-width:800px){table{display:block;overflow:auto;white-space:nowrap}}
</style>
</head>
<body>
<header>
  <div class="dot"></div>
  <h1>BinMate Admin</h1>
  <span class="meta">Internal use only · <a href="/api/v1/health">API health</a></span>
</header>
<section class="stats">
  <div class="card"><div class="val">${councils.length}</div><div class="lbl">Councils</div></div>
  <div class="card"><div class="val">${scraperCount}</div><div class="lbl">Registered Scrapers</div></div>
  <div class="card"><div class="val">${totalZones}</div><div class="lbl">Seeded Zones</div></div>
  <div class="card"><div class="val" id="userCount">…</div><div class="lbl">Users</div></div>
</section>
<section class="actions">
  <div class="panel">
    <h2>Admin APIs</h2>
    <p>Summary, users, zones, holidays, address cache, scraper runs, and manual notification trigger are now served from authenticated JSON endpoints under <span class="mono">/admin/api/*</span>.</p>
  </div>
  <div class="panel">
    <h2>Operations</h2>
    <div class="stack">
      <button class="btn primary" id="runAllBtn" onclick="runAllScrapers()">Run all scrapers</button>
      <button class="btn" onclick="triggerNotifications()">Trigger notifications</button>
      <button class="btn" onclick="loadSummary()">Refresh summary</button>
    </div>
    <p class="dim" id="opsStatus" style="margin-top:10px">No admin action running.</p>
  </div>
</section>
<main>
  <h3>Scrapers &amp; Coverage</h3>
  <table>
    <thead><tr>
      <th>Council</th><th>Platform</th><th style="text-align:right">Zones</th>
      <th>Last scraped</th><th>Status</th><th>Health</th><th>Actions</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</main>
<script>
async function postJson(url, options) {
  const response = await fetch(url, { method: 'POST', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function loadSummary() {
  try {
    const data = await fetch('/admin/api/summary').then((r) => r.json());
    document.getElementById('userCount').textContent = data.summary.users.total;
    document.getElementById('opsStatus').textContent =
      'DB ' + data.system.db.status + ' · ' + data.system.deployment.gitSha;
  } catch (error) {
    document.getElementById('opsStatus').textContent = 'Failed to refresh summary';
  }
}

async function runCheck(slug, btn) {
  const cell = btn.closest('tr').querySelector('.health-cell');
  btn.disabled = true;
  btn.textContent = 'Checking';
  try {
    const data = await postJson('/admin/api/scrapers/' + slug + '/health');
    cell.innerHTML = data.healthy
      ? '<span class="badge ok">Healthy</span>'
      : '<span class="badge fail">Failed' + (data.error ? ': ' + data.error : '') + '</span>';
  } catch (error) {
    cell.innerHTML = '<span class="badge fail">' + error.message + '</span>';
  }
  btn.textContent = 'Health';
  btn.disabled = false;
}

async function runScraper(slug, btn) {
  btn.disabled = true;
  btn.textContent = 'Running';
  try {
    const data = await postJson('/admin/api/scrapers/' + slug + '/run');
    document.getElementById('opsStatus').textContent =
      slug + ': refreshed ' + data.refreshed + ', skipped ' + data.skipped;
  } catch (error) {
    document.getElementById('opsStatus').textContent = slug + ': ' + error.message;
  }
  btn.textContent = 'Run';
  btn.disabled = false;
}

async function runAllScrapers() {
  const button = document.getElementById('runAllBtn');
  button.disabled = true;
  button.textContent = 'Running all';
  try {
    const data = await postJson('/admin/api/scrapers/run-all');
    const refreshed = data.reduce((sum, row) => sum + row.refreshed, 0);
    document.getElementById('opsStatus').textContent = 'All scrapers finished · ' + refreshed + ' zones refreshed';
  } catch (error) {
    document.getElementById('opsStatus').textContent = error.message;
  }
  button.textContent = 'Run all scrapers';
  button.disabled = false;
}

async function triggerNotifications() {
  try {
    await postJson('/admin/api/system/notifications/trigger');
    document.getElementById('opsStatus').textContent = 'Notification job triggered successfully';
  } catch (error) {
    document.getElementById('opsStatus').textContent = error.message;
  }
}

loadSummary();
</script>
</body>
</html>`;
}

/** Render one council table row. */
function renderCouncilRow(council: CouncilStat): string {
  const scraperBadge = council.hasScraper
    ? '<span class="badge teal">Live</span>'
    : '<span class="badge muted">No scraper</span>';
  const activeBadge = council.isActive
    ? '<span class="badge lime">Active</span>'
    : '<span class="badge red">Inactive</span>';
  const scraped = council.lastScrapedAt
    ? new Date(council.lastScrapedAt).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '<span class="dim">Never</span>';
  const actions = council.hasScraper
    ? `<div class="stack">
        <button class="btn" onclick="runCheck('${council.slug}', this)">Health</button>
        <button class="btn" onclick="runScraper('${council.slug}', this)">Run</button>
      </div>`
    : '<span class="dim">Unavailable</span>';

  return `<tr>
    <td><strong>${council.name}</strong><br><code>${council.slug}</code></td>
    <td><span class="badge muted">${council.platformType}</span></td>
    <td class="num">${council.zoneCount}</td>
    <td>${scraped}</td>
    <td>${activeBadge} ${scraperBadge}</td>
    <td class="health-cell dim">—</td>
    <td>${actions}</td>
  </tr>`;
}
