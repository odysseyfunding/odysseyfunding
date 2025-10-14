/*
  Snov.io Apps Script integration
  - Token caching
  - Exponential backoff + jitter
  - Parallel email lookups (fetchAll with throttling)
  - Runtime safety caps
*/

/***** CONFIG *****/
const SNOV = {
  CLIENT_ID: 'YOUR_SNOV_CLIENT_ID',
  CLIENT_SECRET: 'YOUR_SNOV_CLIENT_SECRET',

  // Titles you want Snov to return (max 10)
  POSITIONS: ['Owner', 'Founder', 'CEO', 'President', 'Manager'],

  // Sheets & ranges
  INPUT_SHEET: 'Input_Domains',
  INPUT_RANGE: 'A2:A',
  OUTPUT_SHEET: 'Snov Lead Accuracy Tracker',

  // Performance and safety
  MAX_DOMAINS_PER_RUN: 10,
  MAX_PROSPECTS_PER_DOMAIN: 50,
  EMAIL_SEARCH_CONCURRENCY: 5,
  INTER_CHUNK_DELAY_MS: 200,
  POLL: {
    baseDelayMs: 800,
    backoffFactor: 1.6,
    jitterMs: 200,
    maxMs: 60000
  },
  RETRY: {
    maxAttempts: 3,
    baseDelayMs: 500,
    backoffFactor: 2
  }
};

/***** ENTRYPOINT *****/
function syncSnovProspectsByDomain() {
  const ss = SpreadsheetApp.getActive();
  const input = ss.getSheetByName(SNOV.INPUT_SHEET);
  const out = ss.getSheetByName(SNOV.OUTPUT_SHEET);
  if (!input || !out) {
    throw new Error('Missing required sheets. Create tabs: ' + SNOV.INPUT_SHEET + ' and ' + SNOV.OUTPUT_SHEET);
  }

  const token = getAccessToken_();
  const domainsAll = input.getRange(SNOV.INPUT_RANGE).getValues()
    .map(r => (r[0] || '').toString().trim().toLowerCase())
    .filter(d => d && d.indexOf('.') > 0);
  const domains = Array.from(new Set(domainsAll))
    .slice(0, SNOV.MAX_DOMAINS_PER_RUN || domainsAll.length);
  if (!domains.length) return;

  const existingEmails = getExistingEmails_(out);
  const rowsToAppend = [];

  const positions = (SNOV.POSITIONS || []).slice(0, 10);

  for (const domain of domains) {
    const prospects = fetchProspectsForDomain_(token, domain, positions)
      .slice(0, SNOV.MAX_PROSPECTS_PER_DOMAIN || 9999);

    if (!prospects.length) continue;

    const emailMap = fetchEmailsForProspects_(token, prospects);
    for (const p of prospects) {
      const emailInfo = emailMap.get(p.prospect_hash);
      if (!emailInfo || !emailInfo.email) continue;

      const email = (emailInfo.email || '').toLowerCase();
      if (!email || existingEmails.has(email)) continue;

      const company = p.company || '';
      const title = p.position || '';
      const status = (emailInfo.status || '').toLowerCase();

      rowsToAppend.push([
        company,          // A Company
        domain,           // B Domain
        email,            // C Email
        status,           // D Email Status
        title,            // E Title
        '',               // F Industry Keyword
        '',               // G State
        '',               // H Domain Age (yrs)
        '',               // I Email Type (formula)
        '',               // J Fundability Score (formula)
        ''                // K Accuracy Flag (formula)
      ]);
      existingEmails.add(email);
    }
  }

  if (rowsToAppend.length) {
    const startRow = Math.max(out.getLastRow() + 1, 2);
    out.getRange(startRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  }
}

/***** AUTH (with caching) *****/
function getAccessToken_() {
  const props = PropertiesService.getScriptProperties();
  const cachedToken = props.getProperty('SNOV_ACCESS_TOKEN');
  const cachedExp = Number(props.getProperty('SNOV_ACCESS_TOKEN_EXPIRES_AT') || '0');
  const now = Date.now();
  if (cachedToken && now < (cachedExp - 60 * 1000)) return cachedToken; // 60s leeway

  const url = 'https://api.snov.io/v1/oauth/access_token';
  const payload = {
    grant_type: 'client_credentials',
    client_id: SNOV.CLIENT_ID,
    client_secret: SNOV.CLIENT_SECRET
  };
  const res = withRetry_(() => UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: payload,
    muteHttpExceptions: true
  }), SNOV.RETRY);

  const code = res.getResponseCode();
  const data = safeParseJson_(res.getContentText());
  if (code >= 400 || !data || !data.access_token) {
    throw new Error('Failed to obtain Snov access token: ' + code + ' ' + res.getContentText());
  }

  const expiresInSec = Number(data.expires_in || 3600);
  props.setProperty('SNOV_ACCESS_TOKEN', data.access_token);
  props.setProperty('SNOV_ACCESS_TOKEN_EXPIRES_AT', String(now + (expiresInSec * 1000)));
  return data.access_token;
}

/***** DOMAIN → PROSPECTS *****/
function fetchProspectsForDomain_(token, domain, positionsArr) {
  const headers = { Authorization: 'Bearer ' + token };
  const startUrl = 'https://api.snov.io/v2/domain-search/prospects/start?domain=' + encodeURIComponent(domain);
  const formBody = encodePositionsBody_(positionsArr);

  const startRes = withRetry_(() => UrlFetchApp.fetch(startUrl, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    headers,
    payload: formBody,
    muteHttpExceptions: true
  }), SNOV.RETRY);

  const startJson = safeParseJson_(startRes.getContentText());
  const resultUrl = startJson && startJson.result;
  if (!resultUrl) return [];

  const resultJson = pollResultUrl_(resultUrl, headers, SNOV.POLL);
  const prospects = (resultJson && resultJson.data && resultJson.data.prospects) || [];

  return prospects.map(p => ({
    first_name: p.first_name || '',
    last_name: p.last_name || '',
    position: p.position || '',
    prospect_hash: p.prospect_hash || p.hash || '',
    company: (p.company && p.company.name) ? p.company.name : ''
  })).filter(p => p.prospect_hash);
}

/***** PROSPECTS → PARALLEL EMAIL LOOKUP *****/
function fetchEmailsForProspects_(token, prospects) {
  const headers = { Authorization: 'Bearer ' + token };
  const startRequests = prospects.map(p => ({
    url: 'https://api.snov.io/v2/domain-search/prospects/search-emails/start/' + encodeURIComponent(p.prospect_hash),
    method: 'post',
    headers,
    muteHttpExceptions: true
  }));

  const startResponses = fetchAllChunked_(startRequests, SNOV.EMAIL_SEARCH_CONCURRENCY, SNOV.INTER_CHUNK_DELAY_MS);
  const jobs = [];
  for (let i = 0; i < startResponses.length; i++) {
    const p = prospects[i];
    const res = startResponses[i];
    const json = safeParseJson_(res.getContentText());
    const resultUrl = json && json.result;
    if (resultUrl) jobs.push({ prospect: p, resultUrl: resultUrl });
  }

  const emailMap = new Map();
  let pending = jobs.slice();
  let delay = SNOV.POLL.baseDelayMs || 800;
  const maxMs = SNOV.POLL.maxMs || 60000;
  const startTime = Date.now();

  while (pending.length && (Date.now() - startTime) < maxMs) {
    const getRequests = pending.map(j => ({
      url: j.resultUrl,
      method: 'get',
      headers,
      muteHttpExceptions: true
    }));
    const getResponses = fetchAllChunked_(getRequests, SNOV.EMAIL_SEARCH_CONCURRENCY, 0);

    const stillPending = [];
    for (let i = 0; i < getResponses.length; i++) {
      const res = getResponses[i];
      const code = res.getResponseCode();
      const json = safeParseJson_(res.getContentText());

      if (code >= 400 || !json) {
        stillPending.push(pending[i]);
        continue;
      }
      const jobStatus = String(json.status || '').toLowerCase();
      if (jobStatus === 'in_progress' || jobStatus === 'queued' || jobStatus === 'processing') {
        stillPending.push(pending[i]);
        continue;
      }

      const emails = (json.data && json.data.emails) || [];
      const chosen = pickBestEmail_(emails);
      if (chosen) {
        emailMap.set(pending[i].prospect.prospect_hash, chosen);
      }
    }

    if (stillPending.length === pending.length) {
      const jitter = Math.floor(Math.random() * (SNOV.POLL.jitterMs || 0));
      Utilities.sleep(delay + jitter);
      delay = Math.min(Math.floor(delay * (SNOV.POLL.backoffFactor || 1.6)), 5000);
    }
    pending = stillPending;
  }

  return emailMap;
}

/***** HELPERS *****/
function getExistingEmails_(outSheet) {
  const lastRow = outSheet.getLastRow();
  if (lastRow < 2) return new Set();
  const values = outSheet.getRange(2, 3, lastRow - 1, 1).getValues();
  const set = new Set();
  for (const r of values) {
    const e = (r[0] || '').toString().trim().toLowerCase();
    if (e) set.add(e);
  }
  return set;
}

function encodePositionsBody_(positionsArr) {
  if (!positionsArr || !positionsArr.length) return '';
  return positionsArr.map(p => 'positions[]=' + encodeURIComponent(p)).join('&');
}

function pollResultUrl_(url, headers, cfg) {
  const baseDelay = (cfg && cfg.baseDelayMs) || 800;
  const backoff = (cfg && cfg.backoffFactor) || 1.6;
  const jitterMs = (cfg && cfg.jitterMs) || 200;
  const maxMs = (cfg && cfg.maxMs) || 60000;

  const start = Date.now();
  let delay = baseDelay;
  while ((Date.now() - start) < maxMs) {
    const res = UrlFetchApp.fetch(url, { method: 'get', headers, muteHttpExceptions: true });
    const code = res.getResponseCode();
    const json = safeParseJson_(res.getContentText());
    if (code < 400 && json && String(json.status || '').toLowerCase() !== 'in_progress' && String(json.status || '').toLowerCase() !== 'queued' && String(json.status || '').toLowerCase() !== 'processing') {
      return json;
    }
    const jitter = Math.floor(Math.random() * jitterMs);
    Utilities.sleep(delay + jitter);
    delay = Math.min(Math.floor(delay * backoff), 5000);
  }
  return null;
}

function pickBestEmail_(emails) {
  if (!emails || !emails.length) return null;
  const rank = { valid: 3, accept_all: 2, catch_all: 2, unknown: 1, invalid: -1 };
  let best = null, bestScore = -999;
  for (const e of emails) {
    const status = String(e.status || '').toLowerCase();
    const score = status in rank ? rank[status] : 0;
    if (score > bestScore && e.email) {
      best = { email: e.email, status: status };
      bestScore = score;
    }
  }
  if (best && best.status === 'invalid') return null;
  return best;
}

function fetchAllChunked_(requests, chunkSize, interChunkDelayMs) {
  if (!requests.length) return [];
  const size = Math.max(1, Number(chunkSize) || 5);
  const delay = Math.max(0, Number(interChunkDelayMs) || 0);
  const results = [];
  for (let i = 0; i < requests.length; i += size) {
    const slice = requests.slice(i, i + size);
    const resSlice = UrlFetchApp.fetchAll(slice);
    for (const r of resSlice) results.push(r);
    if (i + size < requests.length && delay) Utilities.sleep(delay);
  }
  return results;
}

function withRetry_(fn, retryCfg) {
  const maxAttempts = (retryCfg && retryCfg.maxAttempts) || 3;
  const baseDelay = (retryCfg && retryCfg.baseDelayMs) || 500;
  const factor = (retryCfg && retryCfg.backoffFactor) || 2;

  let attempt = 0;
  let delay = baseDelay;
  while (true) {
    try {
      const res = fn();
      const code = res.getResponseCode();
      if (code < 400 || !isTransientStatus_(code)) return res;
    } catch (e) {
      // continue to retry if attempts remain
    }
    attempt++;
    if (attempt >= maxAttempts) return fn();
    Utilities.sleep(delay);
    delay = Math.min(delay * factor, 5000);
  }
}

function isTransientStatus_(code) {
  return code === 429 || code === 500 || code === 502 || code === 503 || code === 504;
}

function safeParseJson_(text) {
  try { return JSON.parse(text || '{}'); } catch (e) { return null; }
}

/***** OPTIONAL: set an hourly trigger *****/
function createHourlyTrigger() {
  ScriptApp.newTrigger('syncSnovProspectsByDomain')
    .timeBased()
    .everyHours(1)
    .create();
}
