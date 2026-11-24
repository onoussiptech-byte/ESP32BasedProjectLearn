// =============================================================================
// DashboardPage.h - E2: minimal placeholder page served on GET /
// The full bilingual dashboard is subtask E4 and will replace this file.
// This version only proves the link: it polls /api/status every 2 s.
// The string is a const array, so it stays in flash (no RAM used).
// =============================================================================
#pragma once                                   // include this header only once

static const char DASHBOARD_HTML[] = R"HTML(<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AQUA-NODE</title>
<style>body{font-family:sans-serif;margin:16px;background:#f4f7f6;color:#123}
h1{font-size:20px}pre{background:#fff;padding:12px;border-radius:8px;white-space:pre-wrap}</style>
</head><body>
<h1>AQUA-NODE (firmware placeholder page)</h1>
<p>Live status from <code>/api/status</code>, refreshed every 2 s. The full dashboard is subtask E4.</p>
<pre id="s">loading...</pre>
<script>
async function poll(){try{const r=await fetch('/api/status');
document.getElementById('s').textContent=JSON.stringify(await r.json(),null,2)+'\n'+new Date().toLocaleTimeString();}
catch(e){document.getElementById('s').textContent='connection lost';}}
poll();setInterval(poll,2000);
</script></body></html>)HTML";
