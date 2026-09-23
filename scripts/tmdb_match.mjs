// Batch-match catalog titles to TMDB and cache the results.
//
// Usage (from videodrome_atl/):
//   DATABASE_URL=... TMDB_READ_TOKEN=...  node scripts/tmdb_match.mjs
//   (or TMDB_API_KEY=... for a v3 key)
//
// Flags:
//   --retry     also re-attempt titles previously marked nomatch/error
//   --limit=N   only process the first N unmatched titles (for a test run)
//
// Safe to re-run: already-matched titles are skipped, so you can stop/resume.
import postgres from "postgres";
import { makeTmdb, sleep, cleanExpr, candidateQueries, buildRow } from "./lib/tmdb_common.mjs";

const DB = process.env.DATABASE_URL;
const TOKEN = process.env.TMDB_READ_TOKEN;
const APIKEY = process.env.TMDB_API_KEY;
if (!DB) { console.error("DATABASE_URL required"); process.exit(1); }
if (!TOKEN && !APIKEY) { console.error("TMDB_READ_TOKEN or TMDB_API_KEY required"); process.exit(1); }

const RETRY = process.argv.includes("--retry");
const BACKFILL_TITLES = process.argv.includes("--backfill-titles");
const BACKFILL_COUNTRY = process.argv.includes("--backfill-country");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1]) || 0;

const sql = postgres(DB, { prepare: false });
const tmdb = makeTmdb({ token: TOKEN, apiKey: APIKEY });

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS tmdb_cache (
      title text PRIMARY KEY, tmdb_title text, tmdb_id bigint, media_type text, poster_path text,
      backdrop_path text, overview text, release_year bigint, genres text,
      director text, top_cast text, vote_average double precision, extra_tmdb_ids text, country text,
      status text NOT NULL DEFAULT 'nomatch', updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`ALTER TABLE tmdb_cache ADD COLUMN IF NOT EXISTS tmdb_title text`;
  await sql`ALTER TABLE tmdb_cache ADD COLUMN IF NOT EXISTS country text`;
}

// Backfill primary production country for already-matched rows.
async function backfillCountry() {
  const rows = await sql`
    SELECT title, tmdb_id, coalesce(media_type, 'movie') AS media_type
    FROM tmdb_cache WHERE status = 'ok' AND tmdb_id IS NOT NULL AND country IS NULL`;
  console.log(`${rows.length} matched rows missing a country.`);
  let done = 0, err = 0;
  for (const r of rows) {
    try {
      const d = await tmdb(`/${r.media_type === "tv" ? "tv" : "movie"}/${r.tmdb_id}`);
      const country = (d.production_countries || [])[0]?.name || null;
      await sql`UPDATE tmdb_cache SET country = ${country} WHERE title = ${r.title}`;
      done++;
    } catch (e) {
      err++;
      if ((done + err) % 200 === 0) console.error(`  error on "${r.title}": ${e.message}`);
    }
    if ((done + err) % 200 === 0) console.log(`  ${done + err}/${rows.length}`);
    await sleep(40);
  }
  console.log(`\nCountry backfill done. updated=${done} error=${err}`);
}

async function upsert(title, r) {
  await sql`
    INSERT INTO tmdb_cache (title, tmdb_title, tmdb_id, media_type, poster_path, backdrop_path,
      overview, release_year, genres, director, top_cast, vote_average, country, status, updated_at)
    VALUES (${title}, ${r.tmdb_title ?? null}, ${r.tmdb_id ?? null}, ${r.media_type ?? null}, ${r.poster_path ?? null},
      ${r.backdrop_path ?? null}, ${r.overview ?? null}, ${r.release_year ?? null},
      ${r.genres ?? null}, ${r.director ?? null}, ${r.top_cast ?? null},
      ${r.vote_average ?? null}, ${r.country ?? null}, ${r.status}, now())
    ON CONFLICT (title) DO UPDATE SET
      tmdb_title=EXCLUDED.tmdb_title, tmdb_id=EXCLUDED.tmdb_id, media_type=EXCLUDED.media_type,
      poster_path=EXCLUDED.poster_path, backdrop_path=EXCLUDED.backdrop_path, overview=EXCLUDED.overview,
      release_year=EXCLUDED.release_year, genres=EXCLUDED.genres, director=EXCLUDED.director,
      top_cast=EXCLUDED.top_cast, vote_average=EXCLUDED.vote_average, country=EXCLUDED.country,
      status=EXCLUDED.status, updated_at=now()`;
}

// Backfill canonical titles for already-matched rows that predate the tmdb_title column.
async function backfillTitles() {
  const rows = await sql`
    SELECT title, tmdb_id, coalesce(media_type, 'movie') AS media_type
    FROM tmdb_cache WHERE status = 'ok' AND tmdb_id IS NOT NULL AND tmdb_title IS NULL`;
  console.log(`${rows.length} matched rows missing a canonical title.`);
  let done = 0, healed = 0, dropped = 0, err = 0;
  for (const r of rows) {
    try {
      const d = await tmdb(`/${r.media_type === "tv" ? "tv" : "movie"}/${r.tmdb_id}`);
      const name = d.title || d.name || null;
      await sql`UPDATE tmdb_cache SET tmdb_title = ${name} WHERE title = ${r.title}`;
      done++;
    } catch (e) {
      if (String(e.message).includes("404")) {
        // stale/deleted or wrong id — re-resolve the title from scratch.
        try {
          const m = await match(r.title);
          await upsert(r.title, m);
          if (m.status === "ok") { healed++; } else { dropped++; }
        } catch (e2) {
          err++;
          console.error(`  re-match failed for "${r.title}": ${e2.message}`);
        }
      } else {
        err++;
        console.error(`  error on "${r.title}" (${r.tmdb_id}): ${e.message}`);
      }
    }
    if ((done + healed + dropped + err) % 200 === 0)
      console.log(`  ${done + healed + dropped + err}/${rows.length}`);
    await sleep(40);
  }
  console.log(`\nBackfill done. titled=${done} re-matched=${healed} unmatched=${dropped} error=${err}`);
}

// Same cleaned-title expression the app groups/joins on (keep in sync with queries.ts).
const CLEAN = cleanExpr(sql);

async function titlesToProcess() {
  // Default: skip every title already attempted. --retry: only skip successful ones.
  const alreadyDone = RETRY ? sql`status = 'ok'` : sql`TRUE`;
  const rows = await sql`
    SELECT DISTINCT ${CLEAN} AS title
    FROM inventor
    WHERE ${CLEAN} <> '' AND ${CLEAN} !~ '^\\('
      AND ${CLEAN} NOT IN (SELECT title FROM tmdb_cache WHERE ${alreadyDone})
    ORDER BY title
    ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}`;
  return rows.map((r) => r.title);
}

async function match(title) {
  // /search/multi covers movies AND TV; try each query variant until one hits.
  let hit = null;
  for (const q of candidateQueries(title)) {
    const search = await tmdb(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false`);
    hit = (search.results || []).find((r) => r.media_type === "movie" || r.media_type === "tv");
    if (hit) break;
  }
  if (!hit) return { status: "nomatch" };
  return buildRow(tmdb, hit);
}

(async () => {
  await ensureTable();
  if (BACKFILL_TITLES) {
    await backfillTitles();
    await sql.end();
    return;
  }
  if (BACKFILL_COUNTRY) {
    await backfillCountry();
    await sql.end();
    return;
  }
  const titles = await titlesToProcess();
  console.log(`${titles.length} titles to match${RETRY ? " (incl. retries)" : ""}.`);
  let ok = 0, none = 0, err = 0;
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    try {
      const r = await match(title);
      await upsert(title, r);
      if (r.status === "ok") ok++; else none++;
    } catch (e) {
      err++;
      await sql`
        INSERT INTO tmdb_cache (title, status, updated_at) VALUES (${title}, 'error', now())
        ON CONFLICT (title) DO UPDATE SET status='error', updated_at=now()`;
      console.error(`  error on "${title}": ${e.message}`);
    }
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${titles.length}  ok=${ok} nomatch=${none} err=${err}`);
    await sleep(40); // ~25 req/s ceiling
  }
  console.log(`\nDone. ok=${ok} nomatch=${none} error=${err}`);
  await sql.end();
})();
