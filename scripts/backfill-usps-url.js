/**
 * Backfill usps_url for stamps currently available in the USPS online store.
 *
 * Scrapes all pages of store.usps.com/store/stamps to collect product URLs,
 * then matches them to our stamps by slug. Only stamps currently in the store
 * get a usps_url; the rest get null.
 *
 * Usage: node scripts/backfill-usps-url.js
 * Re-run anytime to refresh (new stamps added / old ones removed from store).
 */

const fs = require("fs");
const path = require("path");

const STORE_BASE = "https://store.usps.com";
const STAMPS_PAGE = `${STORE_BASE}/store/stamps`;
const OUT_FILE = path.join(__dirname, "../src/data/stamps.json");
const DELAY_MS = 400;

// USPS store slug → our stampsforever slug, for cases where they differ
const SLUG_ALIASES = {
  "global-postcrossing": "postcrossing",
  "colorado-statehood": "colorado-statehood-2",
  "angels-trumpets": "4c-angels-trumpets",
  "putting-a-stamp-on-the-american-experience": "usps-250th-prestige",
  "250-years-of-delivering": "250years",
  "us-marine-corps-250th": "us-marine-corp-250th",
  "global-1794-compass-rose": "1794-compass-rose",
  "alzheimers": "alzheimers-semipostal",
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(No) {
  const url = `${STAMPS_PAGE}?Nrpp=100&No=${No}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} at No=${No}`);
  return res.text();
}

async function collectStoreUrls() {
  const urlMap = new Map(); // slug → full URL
  let No = 0;

  console.log("Scraping USPS store stamps catalog…");
  while (true) {
    const html = await fetchPage(No);
    // Match paths like /store/product/some-slug-stamps-S_123456
    const matches = [...html.matchAll(/\/store\/product\/([a-z0-9-]+)-stamps-S_(\d+)/gi)];
    if (matches.length === 0) break;

    for (const m of matches) {
      const uspsSlug = m[1]; // slug without the trailing "-stamps"
      const ourSlug = SLUG_ALIASES[uspsSlug] ?? uspsSlug;
      const fullPath = m[0];
      urlMap.set(ourSlug, `${STORE_BASE}${fullPath}`);
    }

    console.log(`  No=${No}: ${matches.length} products (${urlMap.size} unique so far)`);
    No += 100;
    if (No < 500) await delay(DELAY_MS);
    else break;
  }

  return urlMap;
}

(async () => {
  const storeUrls = await collectStoreUrls();
  console.log(`\nFound ${storeUrls.size} stamps in USPS store.`);

  const stamps = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8"));

  let matched = 0;
  for (const stamp of stamps) {
    const url = storeUrls.get(stamp.slug) ?? null;
    stamp.usps_url = url;
    if (url) matched++;
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(stamps, null, 2), "utf-8");
  console.log(`Matched ${matched} stamps to USPS store URLs.`);
  console.log(`Wrote ${stamps.length} stamps to ${OUT_FILE}`);
})();
