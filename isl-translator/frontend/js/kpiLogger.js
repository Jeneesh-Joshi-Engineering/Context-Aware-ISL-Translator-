// Shared browser KPI event store; exportable without sending sensitive data elsewhere.
const KEY = "isl-transit-kpi-events";
export function logKpi(event, detail = {}) { const entries=JSON.parse(localStorage.getItem(KEY)||"[]"); entries.push({event,timestamp:new Date().toISOString(),...detail}); localStorage.setItem(KEY,JSON.stringify(entries)); }
export function exportKpisCsv() { const rows=JSON.parse(localStorage.getItem(KEY)||"[]"); if(!rows.length)return; const keys=[...new Set(rows.flatMap(Object.keys))]; const csv=[keys.join(","),...rows.map(r=>keys.map(k=>JSON.stringify(r[k]??"")).join(","))].join("\n"); const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="isl-transit-kpis.csv";a.click();URL.revokeObjectURL(a.href); }
