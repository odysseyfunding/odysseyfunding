import express from "express";
import cors from "cors";
import { scrapeDirectory } from "./scraper.mjs";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.type("html").send(`<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Directory Scraper</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 16px; }
  input, button { font-size: 16px; padding: 10px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  .row > * { flex: 1; min-width: 220px; }
  pre { background: #111; color: #0f0; padding: 12px; overflow:auto; border-radius: 8px; }
  label { display:block; margin-top:12px; font-weight:600; }
  .hint { color:#666; font-size:13px; }
  .pill { display:inline-block; background:#eee; padding:2px 8px; border-radius:999px; font-size:12px; }
  .controls { margin: 12px 0; display:flex; gap:8px; align-items:center; }
  .controls input { width: 88px; }
  .sticky { position: sticky; top: 0; background: #fff; padding-bottom: 8px; }
  .result { border-bottom:1px solid #eee; padding:6px 0; }
  .muted { color:#777; font-size:12px; }
  .name { font-weight:600; }
</style>
<div class="sticky">
  <h2>Directory Scraper <span class="pill">SSE</span></h2>
  <label>Start URL</label>
  <input id="url" placeholder="https://example.com/directory" />
  <div class="controls">
    <label>Concurrency <input id="concurrency" type="number" value="6" min="1" /></label>
    <label>Max Pages <input id="maxPages" type="number" value="9999" min="1" /></label>
  </div>
  <button id="start">Start</button>
  <button id="stop" disabled>Stop</button>
  <div class="hint">Leave this tab in foreground on mobile to keep the connection active.</div>
</div>
<div id="output"></div>
<script>
let es;
const urlInput = document.getElementById('url');
const concInput = document.getElementById('concurrency');
const maxPagesInput = document.getElementById('maxPages');
const out = document.getElementById('output');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');

function addLine(html) {
  const div = document.createElement('div');
  div.className = 'result';
  div.innerHTML = html;
  out.prepend(div);
}

startBtn.onclick = () => {
  if (es) es.close();
  out.innerHTML = '';
  const url = urlInput.value.trim();
  const c = Number(concInput.value||6);
  const m = Number(maxPagesInput.value||9999);
  if (!url) { alert('Enter a URL'); return; }
  const streamUrl = 
    '/scrape/stream?url=' + encodeURIComponent(url) +
    '&concurrency=' + encodeURIComponent(c) +
    '&maxPages=' + encodeURIComponent(m);
  es = new EventSource(streamUrl);
  es.addEventListener('result', (e) => {
    try {
      const data = JSON.parse(e.data);
      addLine('<span class="name">' + (data.name||'(no name)') + '</span> ' +
              '<span class="muted">' + (data.phone||'') + ' ' + (data.email||'') + '</span><br/>' +
              '<a href="' + (data.website||'#') + '" target="_blank">' + (data.website||'') + '</a>');
    } catch {}
  });
  es.addEventListener('done', () => { addLine('<em class="muted">Done</em>'); stopBtn.disabled = true; });
  es.addEventListener('error', (e) => { addLine('<strong>Error:</strong> ' + e.data); stopBtn.disabled = true; });
  es.onerror = () => { addLine('<em class="muted">Connection closed</em>'); stopBtn.disabled = true; };
  stopBtn.disabled = false;
};

stopBtn.onclick = () => { if (es) es.close(); stopBtn.disabled = true; };
</script>`);
});

app.get("/scrape/stream", async (req, res) => {
  const startUrl = String(req.query.url || "").trim();
  if (!startUrl) return res.status(400).json({ error: "Missing url" });

  const options = {
    concurrency: req.query.concurrency ? Number(req.query.concurrency) : undefined,
    maxPages: req.query.maxPages ? Number(req.query.maxPages) : undefined,
    delayMinMs: req.query.delayMin ? Number(req.query.delayMin) : undefined,
    delayMaxMs: req.query.delayMax ? Number(req.query.delayMax) : undefined,
    retries: req.query.retries ? Number(req.query.retries) : undefined,
    headless: true,
    blockAssets: req.query.blockAssets ? String(req.query.blockAssets).toLowerCase() !== 'false' : true,
    followWebsite: req.query.followWebsite ? String(req.query.followWebsite).toLowerCase() !== 'false' : undefined,
    externalDepth: req.query.externalDepth ? Number(req.query.externalDepth) : undefined,
    sameOriginOnly: req.query.sameOriginOnly ? String(req.query.sameOriginOnly).toLowerCase() !== 'false' : undefined,
    maxExternalPages: req.query.maxExternalPages ? Number(req.query.maxExternalPages) : undefined,
  };

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  function sendEvent(event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    await scrapeDirectory({
      startUrl,
      options,
      onResult: (record) => sendEvent('result', record),
    });
    sendEvent('done', { ok: true });
  } catch (error) {
    sendEvent('error', { message: String(error && error.message || error) });
  } finally {
    res.end();
  }
});

app.post("/scrape", async (req, res) => {
  const { startUrl, selectors, options } = req.body || {};
  if (!startUrl) return res.status(400).json({ error: "startUrl is required" });
  try {
    const results = await scrapeDirectory({ startUrl, selectors, options });
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: String(error && error.message || error) });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});
