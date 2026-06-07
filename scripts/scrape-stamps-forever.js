/**
 * Scrapes stamp data from the stampsforever.com admin JSON API.
 *
 * Pass 1 — paginated list API: collect slugs for all stamps issued >= MIN_YEAR.
 * Pass 2 — per-slug detail API: fetch full record (about, people_groupings, etc.)
 *           with CONCURRENCY parallel requests.
 *
 * Usage:
 *   node scripts/scrape-stamps-forever.js          # 2000-present (default)
 *   MIN_YEAR=2010 node scripts/scrape-stamps-forever.js
 *
 * Requires Node 18+ (built-in fetch).
 */

const fs = require("fs");
const path = require("path");

const BASE_API = "https://admin.stampsforever.com/api/stamp-issuances";
const OUT_FILE = path.join(__dirname, "../src/data/stamps.json");
const MIN_YEAR = parseInt(process.env.MIN_YEAR ?? "2000", 10);
const PER_PAGE = 100;
const CONCURRENCY = 4;
const DELAY_MS = 300;
const MAX_RETRIES = 4;

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
      const wait = 1500 * 2 ** attempt;
      await delay(wait);
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------
function stripHtml(str) {
  if (!str) return null;
  return str
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&#8203;/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

// ---------------------------------------------------------------------------
// Pass 1: collect slugs from paginated list API
// ---------------------------------------------------------------------------
async function collectSlugs() {
  console.log(`Collecting stamps issued >= ${MIN_YEAR}…`);
  const slugs = [];
  let page = 1;
  let lastPage = 1;

  do {
    const url = `${BASE_API}?per_page=${PER_PAGE}&sort=-issue_date&page=${page}`;
    const data = await fetchJson(url);
    const stamps = data.data ?? [];
    lastPage = data.meta?.last_page ?? 1;

    let addedThisPage = 0;
    let tooOld = false;

    for (const s of stamps) {
      const year = parseInt(s.issue_year ?? "0", 10);
      if (year < MIN_YEAR) {
        tooOld = true;
        continue;
      }
      if (s.slug) {
        slugs.push({ slug: s.slug, year });
        addedThisPage++;
      }
    }

    process.stdout.write(`  page ${page}/${lastPage} — ${addedThisPage} added (${slugs.length} total)\r`);

    if (tooOld && addedThisPage === 0) {
      console.log(`\n  Reached pre-${MIN_YEAR} stamps, stopping at page ${page}.`);
      break;
    }

    page++;
    if (page <= lastPage) await delay(DELAY_MS);
  } while (page <= lastPage);

  console.log(`\nFound ${slugs.length} stamps issued >= ${MIN_YEAR}`);
  return slugs;
}

// ---------------------------------------------------------------------------
// Pass 2: fetch full detail for each slug
// ---------------------------------------------------------------------------
function mapStamp(d) {
  // Images
  const images = Array.isArray(d.images) ? d.images : [];
  const primaryImg = images[0] ?? null;
  const imgUrl = primaryImg?.derivatives?.medium?.path
    ?? primaryImg?.derivatives?.large?.path
    ?? primaryImg?.path
    ?? null;
  const allImages = images
    .map((img) => img?.derivatives?.medium?.path ?? img?.derivatives?.large?.path ?? img?.path ?? null)
    .filter(Boolean);

  // Topics
  const topics = Array.isArray(d.topics)
    ? d.topics.map((t) => (t && typeof t === "object" ? t.name : t)).filter(Boolean)
    : [];

  // Series
  const seriesRaw = d.series;
  const series =
    seriesRaw && typeof seriesRaw === "object" ? seriesRaw.name ?? null : seriesRaw ?? null;

  // People / designers
  const peopleGroupings = Array.isArray(d.people_groupings) ? d.people_groupings : [];
  const designers = [];
  for (const group of peopleGroupings) {
    if (!group || typeof group !== "object") continue;
    const heading = group.heading ?? "";
    for (const p of (group.people ?? [])) {
      if (p?.name) designers.push({ role: heading, name: p.name });
    }
  }
  const primaryDesigner =
    designers.find((d) => /art director|stamp designer/i.test(d.role))?.name
    ?? designers[0]?.name
    ?? null;

  // Denomination
  const rate = d.rate ? parseFloat(d.rate) : null;
  const rateType = d.rate_type ?? null;
  let denomination = null;
  if (rate && rateType === "Forever") denomination = `$${rate.toFixed(2)} Forever`;
  else if (rate) denomination = `$${rate.toFixed(2)}`;
  else if (rateType === "Forever") denomination = "Forever";
  else if (rateType) denomination = rateType;

  // Sheet / pane image
  const pane = d.stamp_pane ?? null;
  const sheetImg = pane?.derivatives?.medium?.path
    ?? pane?.derivatives?.large?.path
    ?? pane?.path
    ?? null;

  return {
    slug: d.slug,
    name: d.name ?? null,
    year: d.issue_year ? parseInt(d.issue_year, 10) : null,
    issued: d.issue_date ?? null,
    city: d.issue_location || null,
    denomination,
    cost: rate,
    series,
    topics,
    designer: primaryDesigner,
    designers,
    img: imgUrl,
    images: allImages,
    sheet_img: sheetImg,
    description: stripHtml(d.about) || stripHtml(d.seo_summary) || null,
    url: `https://www.stampsforever.com/stamps/${d.slug}`,
  };
}

async function fetchDetails(slugEntries) {
  const results = [];
  let ok = 0;
  let failed = 0;
  const total = slugEntries.length;

  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = slugEntries.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(({ slug }) => fetchJson(`${BASE_API}/${slug}`))
    );

    for (let j = 0; j < settled.length; j++) {
      const { status, value, reason } = settled[j];
      if (status === "fulfilled") {
        results.push(mapStamp(value));
        ok++;
      } else {
        console.error(`\n  ✗ ${batch[j].slug}: ${reason?.message}`);
        failed++;
      }
    }

    const done = Math.min(i + CONCURRENCY, total);
    process.stdout.write(`  ${done}/${total} fetched (${failed} errors)\r`);
    if (done < total) await delay(DELAY_MS);
  }

  process.stdout.write("\n");
  return { results, ok, failed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  const slugEntries = await collectSlugs();

  // If a stamps.json already exists, skip slugs we already have successfully
  let existing = [];
  if (fs.existsSync(OUT_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8"));
      const existingSlugs = new Set(existing.map((s) => s.slug));
      const before = slugEntries.length;
      const remaining = slugEntries.filter((e) => !existingSlugs.has(e.slug));
      if (remaining.length < before) {
        console.log(`Skipping ${before - remaining.length} already-fetched stamps, ${remaining.length} remaining.`);
        slugEntries.length = 0;
        slugEntries.push(...remaining);
      }
    } catch { existing = []; }
  }

  console.log(`\nFetching full details (${CONCURRENCY} concurrent)…`);
  const { results, ok, failed } = await fetchDetails(slugEntries);

  // Merge with previously fetched stamps
  const all = [...existing, ...results];

  // Sort chronologically
  all.sort((a, b) => {
    if (a.year !== b.year) return (a.year ?? 0) - (b.year ?? 0);
    if (a.issued && b.issued) return new Date(a.issued) - new Date(b.issued);
    return 0;
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(all, null, 2), "utf-8");
  console.log(`\nDone. ${ok} scraped, ${failed} failed.`);
  console.log(`Wrote ${all.length} stamps to ${OUT_FILE}`);
})();
