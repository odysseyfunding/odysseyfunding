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

function normalizeUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function unique(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
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
    followWebsite: true,
    externalDepth: 1,
    sameOriginOnly: true,
    maxExternalPages: 6,
    contactPaths: [
      "/contact",
      "/contact-us",
      "/contactus",
      "/about",
      "/about-us",
      "/team",
      "/impressum",
      "/legal",
      "/company",
      "/kontakt",
      "/contacts",
      "/support",
      "/get-in-touch",
      "/find-us",
    ],
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

  async function extractEmailsPhones(page) {
    try {
      const { emails, phones } = await page.evaluate(() => {
        const text = document.body ? document.body.innerText : "";
        const hrefs = Array.from(document.querySelectorAll('a[href]'))
          .map((a) => a.getAttribute('href') || '')
          .join('\n');
        const source = `${text}\n${hrefs}`;
        const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
        const phoneRegex = /(?:\+\d{1,3}[\s()-]*)?(?:\d[\s()-]*){7,15}/g;
        const foundEmails = (source.match(emailRegex) || []).map((e) => e.trim());
        const foundPhones = (source.match(phoneRegex) || [])
          .map((p) => p.replace(/\s+/g, ' ').trim())
          .filter((p) => p.replace(/\D/g, '').length >= 7);
        return { emails: Array.from(new Set(foundEmails)), phones: Array.from(new Set(foundPhones)) };
      });
      return { emails: emails || [], phones: phones || [] };
    } catch {
      return { emails: [], phones: [] };
    }
  }

  async function discoverContactsOnWebsite(page, websiteUrl, options) {
    const origin = (() => { try { return new URL(websiteUrl).origin; } catch { return null; } })();
    if (!origin) return { emails: [], phones: [] };

    const visited = new Set();
    const queue = [];

    // Seed queue: homepage + common contact paths
    queue.push({ url: websiteUrl, depth: 0 });
    for (const path of options.contactPaths) {
      const abs = normalizeUrl(websiteUrl, path);
      if (abs) queue.push({ url: abs, depth: 1 });
    }

    const maxPages = Math.max(1, options.maxExternalPages);
    const maxDepth = Math.max(0, options.externalDepth);

    const aggregate = { emails: [], phones: [] };

    while (queue.length && visited.size < maxPages) {
      const { url, depth } = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);

      if (options.sameOriginOnly) {
        try {
          if (new URL(url).origin !== origin) continue;
        } catch {
          continue;
        }
      }

      try {
        await withRetries(
          async () => {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.navTimeoutMs });
          },
          options.retries,
          400
        );
      } catch {
        continue;
      }

      const { emails, phones } = await extractEmailsPhones(page);
      aggregate.emails.push(...emails);
      aggregate.phones.push(...phones);

      if (depth < maxDepth && visited.size < maxPages) {
        try {
          const candidateHrefs = await page.evaluate(() =>
            Array.from(document.querySelectorAll('a[href]'))
              .map((a) => ({ href: a.getAttribute('href') || '', text: (a.textContent || '').toLowerCase() }))
              .filter((x) => x.href)
          );

          const interesting = candidateHrefs.filter((x) => {
            const t = x.text || '';
            const h = x.href.toLowerCase();
            return (
              h.includes('contact') ||
              h.includes('about') ||
              h.includes('impressum') ||
              h.includes('legal') ||
              h.includes('team') ||
              t.includes('contact') ||
              t.includes('about') ||
              t.includes('impressum') ||
              t.includes('legal') ||
              t.includes('team')
            );
          });

          for (const link of interesting) {
            const abs = normalizeUrl(url, link.href);
            if (abs && !visited.has(abs)) {
              queue.push({ url: abs, depth: depth + 1 });
            }
          }
        } catch {
          // ignore extraction failures
        }
      }
    }

    aggregate.emails = unique(aggregate.emails);
    aggregate.phones = unique(aggregate.phones);
    return aggregate;
  }

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
          let phone = await textOrNull(detailPage, SELECTORS.phone);
          let email = await textOrNull(detailPage, SELECTORS.email);
          const website = await attrOrNull(detailPage, SELECTORS.website, "href");

          // If requested, attempt to discover contacts on the external website
          if (website && options.followWebsite) {
            try {
              const contacts = await discoverContactsOnWebsite(detailPage, website, options);
              if (!email && contacts.emails.length) email = contacts.emails[0];
              if (!phone && contacts.phones.length) phone = contacts.phones[0];
            } catch {
              // ignore external crawl failures
            }
          }

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
