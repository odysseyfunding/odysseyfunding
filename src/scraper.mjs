import { chromium } from "playwright";

const DEFAULT_SELECTORS = {
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

function buildOptions(userOptions = {}) {
  const options = {
    concurrency: 6,
    maxPages: Number.POSITIVE_INFINITY,
    delayMinMs: 200,
    delayMaxMs: 500,
    navTimeoutMs: 30000,
    actionTimeoutMs: 5000,
    retries: 2,
    headless: true,
    blockAssets: true,
    ...userOptions,
  };
  if (options.concurrency < 1) options.concurrency = 1;
  if (options.delayMinMs < 0) options.delayMinMs = 0;
  if (options.delayMaxMs < options.delayMinMs) options.delayMaxMs = options.delayMinMs;
  if (options.retries < 0) options.retries = 0;
  return options;
}

export async function scrapeDirectory({
  startUrl,
  selectors: selectorOverrides = {},
  options: userOptions = {},
  onResult,
}) {
  if (!startUrl) throw new Error("startUrl is required");
  const options = buildOptions(userOptions);
  const SELECTORS = { ...DEFAULT_SELECTORS, ...selectorOverrides };

  const browser = await chromium.launch({ headless: options.headless });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36",
  });
  context.setDefaultNavigationTimeout(options.navTimeoutMs);

  if (options.blockAssets) {
    await context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "media", "font", "stylesheet"].includes(type)) return route.abort();
      return route.continue();
    });
  }

  const page = await context.newPage();
  page.setDefaultTimeout(options.actionTimeoutMs);
  await page.goto(startUrl, { waitUntil: "domcontentloaded" });

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
    const workerCount = Math.min(options.concurrency, urlsToProcess.length);
    const workers = Array.from({ length: workerCount }, async () => {
      const detailPage = await context.newPage();
      detailPage.setDefaultTimeout(options.actionTimeoutMs);
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
                timeout: options.navTimeoutMs,
              });
            },
            options.retries,
            400
          );

          const showContact = detailPage.locator(SELECTORS.showContact).first();
          if (await showContact.count()) {
            try {
              await showContact.click({ timeout: options.actionTimeoutMs });
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
          if (typeof onResult === "function") onResult(record);
          results.push(record);

          const jitter = options.delayMinMs + Math.random() * (options.delayMaxMs - options.delayMinMs);
          if (jitter > 0) await delay(jitter);
        }
      } finally {
        await detailPage.close();
      }
    });

    await Promise.all(workers);
  }

  while (true) {
    await page.waitForSelector(SELECTORS.listingCard, { timeout: 15000 }).catch(() => null);
    const detailUrls = await page
      .locator(`${SELECTORS.listingCard} ${SELECTORS.detailsLink}`)
      .evaluateAll((anchors) =>
        anchors
          .map((a) => (a instanceof HTMLAnchorElement ? a.href : null))
          .filter(Boolean)
      );

    await processDetailUrls(detailUrls);

    const nextLink = page.locator(SELECTORS.nextPage).first();
    if (await nextLink.count()) {
      const prevUrl = page.url();
      const href = await nextLink.getAttribute("href");
      if (href) {
        const absolute = href.startsWith("http") ? href : new URL(href, prevUrl).toString();
        await page.goto(absolute, { waitUntil: "domcontentloaded" });
      } else {
        await Promise.all([
          page.waitForURL((u) => u.toString() !== prevUrl, { timeout: 15000 }).catch(() => null),
          nextLink.click(),
        ]);
        await page.waitForLoadState("networkidle").catch(() => null);
      }

      pageNum += 1;
      if (pageNum > options.maxPages) break;
      const jitter = options.delayMinMs + Math.random() * (options.delayMaxMs - options.delayMinMs);
      if (jitter > 0) await delay(jitter);
    } else {
      break;
    }
  }

  await browser.close();
  return results;
}
