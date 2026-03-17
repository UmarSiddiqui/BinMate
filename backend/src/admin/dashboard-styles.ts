/** Returns the inline CSS for the admin dashboard. */
export function getDashboardStyles(): string {
  return `*{box-sizing:border-box;margin:0;padding:0}
body{background:#0D0F12;color:#F0F2F5;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
a{color:#B8F04A}
button{font:inherit;cursor:pointer}
input,select{font:inherit;background:#111318;color:#F0F2F5;border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:6px 10px;outline:none}
input:focus,select:focus{border-color:#B8F04A}
header{background:#1A1D22;border-bottom:1px solid rgba(255,255,255,.07);padding:12px 24px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:10}
header h1{font-size:15px;font-weight:700}
.dot{width:8px;height:8px;background:#B8F04A;border-radius:50%;flex-shrink:0}
.meta{margin-left:auto;font-size:12px;color:#6B7480}
nav{background:#1A1D22;border-bottom:1px solid rgba(255,255,255,.07);padding:0 24px;display:flex;gap:2px;overflow-x:auto}
.tab-btn{background:none;border:none;color:#6B7480;padding:10px 14px;font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
.tab-btn:hover{color:#F0F2F5}
.tab-btn.active{color:#B8F04A;border-bottom-color:#B8F04A}
.page{display:none;padding:24px;max-width:1200px}
.page.active{display:block}
.stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:20px}
.card{background:#1A1D22;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px 20px}
.card .val{font-size:26px;font-weight:700;color:#B8F04A}
.card .val.sm{font-size:16px;line-height:1.3}
.card .lbl{font-size:11px;color:#6B7480;margin-top:2px;text-transform:uppercase;letter-spacing:.06em}
.card .sub{font-size:11px;color:#6B7480;margin-top:4px}
.panel{background:#1A1D22;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px 20px;margin-bottom:20px}
.panel-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:10px;flex-wrap:wrap}
.panel h2{font-size:13px;font-weight:600}
h3{font-size:11px;font-weight:600;color:#6B7480;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}
table{width:100%;border-collapse:collapse;background:#1A1D22;border-radius:12px;overflow:hidden;margin-bottom:16px}
th{text-align:left;padding:10px 14px;font-size:11px;font-weight:500;color:#6B7480;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid rgba(255,255,255,.07)}
td{padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(255,255,255,.02)}
td.r{text-align:right;font-variant-numeric:tabular-nums}
code{font-size:11px;color:#9BA3AD;font-family:Menlo,monospace}
.dim{color:#6B7480}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500}
.lime{background:rgba(184,240,74,.12);color:#B8F04A}
.teal{background:rgba(77,206,188,.12);color:#4DCEBC}
.red{background:rgba(232,72,72,.12);color:#E84848}
.muted{background:rgba(255,255,255,.07);color:#9BA3AD}
.warn{background:rgba(255,183,0,.12);color:#FFB700}
.btn{background:rgba(255,255,255,.07);color:#F0F2F5;border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:6px 12px;font-size:12px}
.btn:hover{background:rgba(255,255,255,.12)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn.p{background:#B8F04A;color:#0D0F12;border-color:#B8F04A}
.btn.p:hover{background:#c7f567}
.btn.d{background:rgba(232,72,72,.08);color:#E84848;border-color:rgba(232,72,72,.25)}
.btn.d:hover{background:rgba(232,72,72,.18)}
.btn.s{padding:4px 8px;font-size:11px}
.sb{background:#1A1D22;border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:8px 14px;font-size:12px;color:#9BA3AD;margin-bottom:16px}
.form-row{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;padding-top:12px;border-top:1px solid rgba(255,255,255,.07);margin-top:4px}
.fg{display:flex;flex-direction:column;gap:4px}
.fg label{font-size:11px;color:#6B7480;text-transform:uppercase;letter-spacing:.06em}
.fg input,.fg select{min-width:140px}
.filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
.ov-modal{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto}
.modal{background:#1A1D22;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;width:100%;max-width:580px}
.modal-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.modal-h h2{font-size:15px;font-weight:600}
.modal dl{display:grid;grid-template-columns:140px 1fr;gap:8px 12px;font-size:13px}
.modal dt{color:#6B7480}
.modal dd{word-break:break-all}
.toast{position:fixed;bottom:24px;right:24px;background:#1A1D22;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:10px 16px;font-size:13px;z-index:300;animation:fadein .2s ease}
@keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(max-width:800px){table{display:block;overflow:auto;white-space:nowrap}}`;
}
