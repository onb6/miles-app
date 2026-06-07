/**
 * One-time backfill: adds sheet_img (stamp_pane) to all stamps in stamps.json
 * that don't already have it.
 *
 * Usage: node scripts/backfill-sheet-img.js
 */

const fs = require("fs");
const path = require("path");

const BASE_API = "https://admin.stampsforever.com/api/stamp-issuances";
const OUT_FILE = path.join(__dirname, "../src/data/stamps.json");
const CONCURRENCY = 6;
const DELAY_MS = 250;
const MAX_RETRIES = 3;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Accept: "application/json",
};

async function fetchJson(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < retries) {
      await delay(1500 * 2 ** attempt);
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

function extractSheetImg(d) {
  const pane = d.stamp_pane ?? null;
  return pane?.derivatives?.medium?.path
    ?? pane?.derivatives?.large?.path
    ?? pane?.path
    ?? null;
}

(async () => {
  const stamps = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8"));
  const toFetch = stamps.filter((s) => !("sheet_img" in s));
  console.log(`Backfilling sheet_img for ${toFetch.length} stamps…`);

  let ok = 0, failed = 0;

  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const batch = toFetch.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(({ slug }) => fetchJson(`${BASE_API}/${slug}`))
    );

    for (let j = 0; j < settled.length; j++) {
      const { status, value, reason } = settled[j];
      const stamp = batch[j];
      if (status === "fulfilled") {
        stamp.sheet_img = extractSheetImg(value);
        ok++;
      } else {
        console.error(`\n  ✗ ${stamp.slug}: ${reason?.message}`);
        stamp.sheet_img = null;
        failed++;
      }
    }

    const done = Math.min(i + CONCURRENCY, toFetch.length);
    process.stdout.write(`  ${done}/${toFetch.length} (${failed} errors)\r`);
    if (done < toFetch.length) await delay(DELAY_MS);
  }

  process.stdout.write("\n");
  fs.writeFileSync(OUT_FILE, JSON.stringify(stamps, null, 2), "utf-8");

  const withSheet = stamps.filter((s) => s.sheet_img).length;
  console.log(`Done. ${ok} fetched, ${failed} failed.`);
  console.log(`${withSheet}/${stamps.length} stamps now have a sheet image.`);
})();
