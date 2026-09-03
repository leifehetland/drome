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

const DB = process.env.DATABASE_URL;
const TOKEN = process.env.TMDB_READ_TOKEN;
const APIKEY = process.env.TMDB_API_KEY;
if (!DB) { console.error("DATABASE_URL required"); process.exit(1); }
if (!TOKEN && !APIKEY) { console.error("TMDB_READ_TOKEN or TMDB_API_KEY required"); process.exit(1); }

const RETRY = process.argv.includes("--retry");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1]) || 0;

const sql = postgres(DB, { prepare: false });
const TMDB = "https://api.themoviedb.org/3";
const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}`, accept: "application/json" } : { accept: "application/json" };
const withKey = (u) => (APIKEY ? `${u}${u.includes("?") ? "&" : "?"}api_key=${APIKEY}` : u);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(withKey(`${TMDB}${path}`), { headers: authHeaders });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") || 2) * 1000;
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
    return res.json();
  }
  throw new Error(`TMDB rate-limited repeatedly for ${path}`);
}

// Normalize a catalog title into a searchable show/movie name: reorder a trailing
// article and strip season/disc/volume/part/edition suffixes.
function normalizeTitle(title) {
  let s = title.trim();
  const m = s.match(/^(.*),\s*(THE|A|AN)\b(.*)$/i); // "SINNER, THE 1.1" -> "THE SINNER 1.1"
  if (m) s = `${m[2]} ${m[1]}${m[3]}`.replace(/\s{2,}/g, " ").trim();
  s = s
    .replace(/\s*#\d+.*$/i, "")
    .replace(/\s*\bDISC?S?\b\s*\d*(\s*&\s*\d+)?.*$/i, "")
    .replace(/\s*\bVOL(?:UME)?\.?\s*\d+.*$/i, "")
    .replace(/\s*\bSEASON\b\s*\d+.*$/i, "")
    .replace(/\s*\bS\.E\.?\b.*$/i, "")
    .replace(/\s*\bSPEC(?:IAL)?\s*ED(?:ITION)?\.?\b.*$/i, "")
    .replace(/\s*-\s*\d+\s*$/i, "")
    .replace(/\s+\d+\.\d+\s*$/i, "")
    .replace(/\s+\d+\s*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s || title.trim();
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS tmdb_cache (
      title text PRIMARY KEY, tmdb_id bigint, media_type text, poster_path text,
      backdrop_path text, overview text, release_year bigint, genres text,
      director text, top_cast text, vote_average double precision,
      status text NOT NULL DEFAULT 'nomatch', updated_at timestamptz NOT NULL DEFAULT now()
    )`;
}

// Same cleaned-title expression the app groups/joins on.
const CLEAN = sql`btrim(regexp_replace(item_title, '^AVAIL[[:space:]]+', '', 'i'))`;

async function titlesToProcess() {
  // Default: skip every title already attempted. --retry: only skip successful ones.
  const alreadyDone = RETRY ? sql`status = 'ok'` : sql`TRUE`;
  const rows = await sql`
    SELECT DISTINCT ${CLEAN} AS title
    FROM inventor
    WHERE upper(btrim(item_title)) <> 'AVAIL'
      AND ${CLEAN} <> '' AND ${CLEAN} !~ '^\\('
      AND ${CLEAN} NOT IN (SELECT title FROM tmdb_cache WHERE ${alreadyDone})
    ORDER BY title
    ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}`;
  return rows.map((r) => r.title);
}

async function match(title) {
  const q = normalizeTitle(title);
  // /search/multi covers movies AND TV shows (most no-matches were TV series discs).
  const search = await tmdb(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false`);
  const hit = (search.results || []).find((r) => r.media_type === "movie" || r.media_type === "tv");
  if (!hit) return { status: "nomatch" };

  const isTv = hit.media_type === "tv";
  const date = isTv ? hit.first_air_date : hit.release_date;
  let director = null, cast = null, genres = null;
  try {
    const d = await tmdb(`/${isTv ? "tv" : "movie"}/${hit.id}?append_to_response=credits`);
    genres = (d.genres || []).map((g) => g.name).join(", ") || null;
    director = isTv
      ? (d.created_by || []).map((c) => c.name).join(", ") || null
      : (d.credits?.crew || []).find((c) => c.job === "Director")?.name ?? null;
    cast = (d.credits?.cast || []).slice(0, 4).map((c) => c.name).join(", ") || null;
  } catch { /* keep search-level data */ }

  return {
    status: "ok",
    tmdb_id: hit.id,
    media_type: hit.media_type,
    poster_path: hit.poster_path,
    backdrop_path: hit.backdrop_path,
    overview: hit.overview || null,
    release_year: date ? Number(String(date).slice(0, 4)) || null : null,
    genres,
    director,
    top_cast: cast,
    vote_average: hit.vote_average ?? null,
  };
}

(async () => {
  await ensureTable();
  const titles = await titlesToProcess();
  console.log(`${titles.length} titles to match${RETRY ? " (incl. retries)" : ""}.`);
  let ok = 0, none = 0, err = 0;
  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    try {
      const r = await match(title);
      await sql`
        INSERT INTO tmdb_cache (title, tmdb_id, media_type, poster_path, backdrop_path,
          overview, release_year, genres, director, top_cast, vote_average, status, updated_at)
        VALUES (${title}, ${r.tmdb_id ?? null}, ${r.media_type ?? null}, ${r.poster_path ?? null},
          ${r.backdrop_path ?? null}, ${r.overview ?? null}, ${r.release_year ?? null},
          ${r.genres ?? null}, ${r.director ?? null}, ${r.top_cast ?? null},
          ${r.vote_average ?? null}, ${r.status}, now())
        ON CONFLICT (title) DO UPDATE SET
          tmdb_id=EXCLUDED.tmdb_id, media_type=EXCLUDED.media_type, poster_path=EXCLUDED.poster_path,
          backdrop_path=EXCLUDED.backdrop_path, overview=EXCLUDED.overview, release_year=EXCLUDED.release_year,
          genres=EXCLUDED.genres, director=EXCLUDED.director, top_cast=EXCLUDED.top_cast,
          vote_average=EXCLUDED.vote_average, status=EXCLUDED.status, updated_at=now()`;
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
