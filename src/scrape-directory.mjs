// Usage:
//   node src/scrape-directory.mjs "https://example.com/directory"
//
// Adjust SELECTORS below to target site structure.

import { chromium } from "playwright";

const START_URL = process.argv[2] || "https://example.com/directory";

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

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36",
  });

  // Speed up: block heavy assets
  await context.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (["image", "media", "font", "stylesheet"].includes(type)) {
      return route.abort();
    }
    return route.continue();
  });

  const page = await context.newPage();
  await page.goto(START_URL, { waitUntil: "domcontentloaded" });

  const results = [];
  let pageNum = 1;

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

    for (const detailUrl of detailUrls) {
      const detailPage = await context.newPage();
      try {
        await detailPage.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

        // Try to reveal contact info if present
        const showContact = detailPage.locator(SELECTORS.showContact).first();
        if (await showContact.count()) {
          try {
            await showContact.click({ timeout: 5000 });
            await detailPage.waitForSelector(SELECTORS.contactInfo, { timeout: 10000 });
          } catch {
            // continue even if contact section doesn't load
          }
        }

        const name = await textOrNull(detailPage, SELECTORS.name);
        const phone = await textOrNull(detailPage, SELECTORS.phone);
        const email = await textOrNull(detailPage, SELECTORS.email);
        const website = await attrOrNull(detailPage, SELECTORS.website, "href");

        results.push({ name, phone, email, website, url: detailUrl });
      } finally {
        await detailPage.close();
      }

      await delay(300 + Math.random() * 500); // small jitter between listings
    }

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
      await delay(800 + Math.random() * 600);
    } else {
      break;
    }
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
