// Usage:
//   node src/scrape-directory.mjs "https://example.com/directory" \
//     --concurrency=6 --maxPages=Infinity \
//     --delayMin=200 --delayMax=500 \
//     --timeoutNav=30000 --timeoutAction=5000 \
//     --headless=true --blockAssets=true --jsonl=false
//
// Adjust SELECTORS below to target site structure.

import { chromium } from "playwright";

const rawArgs = process.argv.slice(2);
const positionalArgs = rawArgs.filter((arg) => !arg.startsWith("--"));
const flagArgs = rawArgs.filter((arg) => arg.startsWith("--"));

const START_URL = positionalArgs[0] || "https://example.com/directory";

function parseFlags(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) continue;
    const eqIndex = token.indexOf("=");
    if (eqIndex !== -1) {
      const key = token.slice(2, eqIndex);
      const value = token.slice(eqIndex + 1);
      parsed[key] = value;
    } else {
      const key = token.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        parsed[key] = next;
        i += 1;
      } else {
        parsed[key] = "true";
      }
    }
  }
  return parsed;
}

const FLAGS = parseFlags(flagArgs);

function getNumberFlag(name, defaultValue) {
  const rawValue = FLAGS[name];
  if (rawValue === undefined) return defaultValue;
  const asNumber = Number(rawValue);
  return Number.isFinite(asNumber) ? asNumber : defaultValue;
}

function getBooleanFlag(name, defaultValue) {
  const rawValue = FLAGS[name];
  if (rawValue === undefined) return defaultValue;
  if (rawValue === "" || rawValue === true) return true;
  const normalized = String(rawValue).toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return defaultValue;
}

const CONCURRENCY = Math.max(1, getNumberFlag("concurrency", 6));
const MAX_PAGES = getNumberFlag("maxPages", Number.POSITIVE_INFINITY);
const DELAY_MIN_MS = Math.max(0, getNumberFlag("delayMin", 200));
const DELAY_MAX_MS = Math.max(DELAY_MIN_MS, getNumberFlag("delayMax", 500));
const NAV_TIMEOUT_MS = getNumberFlag("timeoutNav", 30000);
const ACTION_TIMEOUT_MS = getNumberFlag("timeoutAction", 5000);
const RETRIES = Math.max(0, getNumberFlag("retries", 2));
const HEADLESS = getBooleanFlag("headless", true);
const BLOCK_ASSETS = getBooleanFlag("blockAssets", true);
const JSONL = getBooleanFlag("jsonl", false);

// Update these to match the site
const SELECTORS = {
  listingCard: ".listing-card",
  detailsLink: "a.view-details",
  showContact: ".show-contact",
  contactInfo: ".contact-info",
  name: ".biz-name",
  phone: ".contact-phone",
  email: ".contact-email",
  website: ".website a",
  nextPage: "a.next-page:not(.disabled)",
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function textOrNull(page, selector) {
  try {
    const locator = page.locator(selector).first();
    if (!(await locator.count())) return null;
    const text = await locator.textContent();
    return text?.trim() || null;
  } catch {
    return null;
  }
}

async function attrOrNull(page, selector, name) {
  try {
    const locator = page.locator(selector).first();
    if (!(await locator.count())) return null;
    const value = await locator.getAttribute(name);
    return value || null;
  } catch {
    return null;
  }
}

async function withRetries(fn, retries, baseDelayMs) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const backoff = baseDelayMs * Math.pow(2, attempt) + Math.random() * baseDelayMs;
      await delay(backoff);
    }
  }
  throw lastError;
}

(async () => {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36",
  });

  context.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

  if (BLOCK_ASSETS) {
    // Speed up: block heavy assets
    await context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "media", "font", "stylesheet"].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });
  }

  const page = await context.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  await page.goto(START_URL, { waitUntil: "domcontentloaded" });

  const results = [];
  let pageNum = 1;
  const visitedDetailUrls = new Set();

  async function processDetailUrls(detailUrls) {
    const urlsToProcess = detailUrls.filter((url) => {
      if (visitedDetailUrls.has(url)) return false;
      visitedDetailUrls.add(url);
      return true;
    });

    let sharedIndex = 0;
    const workerCount = Math.min(CONCURRENCY, urlsToProcess.length);
    const workers = Array.from({ length: workerCount }, async () => {
      const detailPage = await context.newPage();
      detailPage.setDefaultTimeout(ACTION_TIMEOUT_MS);
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const currentIndex = sharedIndex;
          sharedIndex += 1;
          if (currentIndex >= urlsToProcess.length) break;
          const detailUrl = urlsToProcess[currentIndex];

          await withRetries(
            async () => {
              await detailPage.goto(detailUrl, {
                waitUntil: "domcontentloaded",
                timeout: NAV_TIMEOUT_MS,
              });
            },
            RETRIES,
            400
          );

          const showContact = detailPage.locator(SELECTORS.showContact).first();
          if (await showContact.count()) {
            try {
              await showContact.click({ timeout: ACTION_TIMEOUT_MS });
              await detailPage
                .waitForSelector(SELECTORS.contactInfo, { timeout: 10000 })
                .catch(() => null);
            } catch {
              // ignore reveal failures
            }
          }

          const name = await textOrNull(detailPage, SELECTORS.name);
          const phone = await textOrNull(detailPage, SELECTORS.phone);
          const email = await textOrNull(detailPage, SELECTORS.email);
          const website = await attrOrNull(detailPage, SELECTORS.website, "href");

          const record = { name, phone, email, website, url: detailUrl };
          if (JSONL) {
            process.stdout.write(`${JSON.stringify(record)}\n`);
          } else {
            results.push(record);
          }

          const jitter = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
          if (jitter > 0) await delay(jitter);
        }
      } finally {
        await detailPage.close();
      }
    });

    await Promise.all(workers);
  }

  while (true) {
    // Wait for listings to appear (if any)
    await page.waitForSelector(SELECTORS.listingCard, { timeout: 15000 }).catch(() => null);

    // Collect absolute detail URLs to avoid stale elements after navigation
    const detailUrls = await page
      .locator(`${SELECTORS.listingCard} ${SELECTORS.detailsLink}`)
      .evaluateAll((anchors) =>
        anchors
          .map((a) => (a instanceof HTMLAnchorElement ? a.href : null))
          .filter(Boolean)
      );

    await processDetailUrls(detailUrls);

    // Pagination
    const nextLink = page.locator(SELECTORS.nextPage).first();
    if (await nextLink.count()) {
      const prevUrl = page.url();
      const href = await nextLink.getAttribute("href");

      if (href) {
        const absolute = href.startsWith("http") ? href : new URL(href, prevUrl).toString();
        await page.goto(absolute, { waitUntil: "domcontentloaded" });
      } else {
        await Promise.all([
          // prefer URL change if navigation occurs
          page.waitForURL((u) => u.toString() !== prevUrl, { timeout: 15000 }).catch(() => null),
          nextLink.click(),
        ]);
        // fallback wait for network idle
        await page.waitForLoadState("networkidle").catch(() => null);
      }

      pageNum += 1;
      if (pageNum > MAX_PAGES) break;
      const jitter = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
      if (jitter > 0) await delay(jitter);
    } else {
      break;
    }
  }

  if (!JSONL) {
    console.log(JSON.stringify(results, null, 2));
  }
  await browser.close();
})();
