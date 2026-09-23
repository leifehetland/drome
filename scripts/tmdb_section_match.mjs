// Director-aware TMDB matching for director sections, plus a mis-filing report.
//
// Why: tmdb_match.mjs matches on title alone (first TMDB hit), so remakes and reused
// titles land on the wrong film (Soderbergh's SOLARIS -> Tarkovsky's). And some items
// are filed under the wrong section code in the POS data (Spielberg under SS, the
// Soderbergh code, instead of SPI).
//
// What it does:
//   1. Works out which store sections are director sections (TMDB person search on the
//      section name, confirmed by how much of the section matches their filmography).
//   2. Matches each title in a director section against that director's filmography and
//      stores the result in tmdb_section_match. The app prefers these rows over the
//      generic title-only match.
//   3. Writes scripts/out/section_report.csv: items in a director section that are NOT
//      by that director, with a suggested section when the real director has one.
//   4. With --apply, writes those suggestions to section_reassign so the site shows the
//      items under the right section (POS data is untouched).
//
// Usage (from videodrome_atl/, after psql -f ../db_test/tmdb_section_match.sql):
//   DATABASE_URL=... TMDB_READ_TOKEN=... node scripts/tmdb_section_match.mjs
//   --section=WH,SS   only these section codes (the report still sees all sections)
//   --apply           also write suggested re-filings to section_reassign
//   --min-titles=N    ignore sections with fewer than N titles (default 3)
//
// Manual overrides:
//   scripts/section_directors.json  section code -> TMDB person names or ids, e.g.
//     { "MAYSLES": ["Albert Maysles", "David Maysles"] }. [] = not a director section.
//   scripts/refile_overrides.json   "CODE|STORE TITLE" -> section code to move it to,
//     or null to keep it where the store shelved it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { makeTmdb, sleep, cleanExpr, candidateQueries, titleKey, buildRow } from "./lib/tmdb_common.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DB = process.env.DATABASE_URL;
const TOKEN = process.env.TMDB_READ_TOKEN;
const APIKEY = process.env.TMDB_API_KEY;
if (!DB) { console.error("DATABASE_URL required"); process.exit(1); }
if (!TOKEN && !APIKEY) { console.error("TMDB_READ_TOKEN or TMDB_API_KEY required"); process.exit(1); }

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1];
const APPLY = process.argv.includes("--apply");
const ONLY = (arg("section") || "").split(",").map((s) => s.trim()).filter(Boolean);
const MIN_TITLES = Number(arg("min-titles")) || 3;
const GENERIC = ["NEW", "DVD", "MIS"];

// A section counts as a director section when at least this much of it is found in
// the director's filmography (guards against a genre section like "Punk Docs"
// happening to match somebody's name).
const MIN_MATCHED = 2;
const MIN_SHARE = 0.25;

const sql = postgres(DB, { prepare: false, onnotice: () => {} });
const tmdb = makeTmdb({ token: TOKEN, apiKey: APIKEY });
const CLEAN = cleanExpr(sql);

// ---- section labels (reuses the fixes in src/db/sectionLabels.ts) ---------------------
function loadLabelFixes() {
  const src = fs.readFileSync(path.join(HERE, "../src/db/sectionLabels.ts"), "utf8");
  const block = src.slice(src.indexOf("const FIXES"), src.indexOf("};", src.indexOf("const FIXES")));
  const fixes = {};
  for (const m of block.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) fixes[m[1]] = m[2];
  return fixes;
}
const FIXES = loadLabelFixes();
const cleanLabel = (raw) => {
  const k = String(raw || "").trim().toUpperCase();
  return FIXES[k] ?? String(raw || "").trim().toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
};

function loadRefileOverrides() {
  const f = path.join(HERE, "refile_overrides.json");
  if (!fs.existsSync(f)) return {};
  const o = JSON.parse(fs.readFileSync(f, "utf8"));
  return Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
}

function loadOverrides() {
  const f = path.join(HERE, "section_directors.json");
  if (!fs.existsSync(f)) return {};
  const o = JSON.parse(fs.readFileSync(f, "utf8"));
  return Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
}

async function ensureTables() {
  await sql.file(path.join(HERE, "../../db_test/tmdb_section_match.sql")).catch(async () => {
    // db_test/ not alongside (e.g. deployed checkout): create inline.
    await sql`CREATE TABLE IF NOT EXISTS tmdb_section_match (
      title text NOT NULL, movie_class text NOT NULL, tmdb_title text, tmdb_id bigint, media_type text,
      poster_path text, backdrop_path text, overview text, release_year bigint, genres text, director text,
      top_cast text, vote_average double precision, country text, extra_tmdb_ids text, method text,
      status text NOT NULL DEFAULT 'ok', updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (title, movie_class))`;
    await sql`CREATE TABLE IF NOT EXISTS section_reassign (
      title text NOT NULL, from_class text NOT NULL, to_class text NOT NULL, reason text,
      updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (title, from_class))`;
  });
}

// ---- directors ------------------------------------------------------------------------
const nameTokens = (s) => titleKey(s).split(" ").filter(Boolean);

async function findPerson(name, requireTokens) {
  const res = await tmdb(`/search/person?query=${encodeURIComponent(name)}&include_adult=false`);
  const want = nameTokens(requireTokens ?? name);
  return (res.results || []).find((p) => {
    if (p.known_for_department !== "Directing" && !requireTokens) return false;
    const have = new Set(nameTokens(p.name));
    return want.every((t) => have.has(t));
  }) || null;
}

/** Override entry -> person: a TMDB person id (number) or a name. */
async function overridePerson(entry) {
  if (typeof entry === "number") {
    const d = await tmdb(`/person/${entry}`);
    return { id: entry, name: d.name || String(entry) };
  }
  return findPerson(entry, entry);
}

/** Title is in this filmography by (normalized) title, no fuzzy search. */
function exactInFilmography(title, idx) {
  return candidateQueries(title).some((q) => idx.byKey.get(titleKey(q))?.length);
}

/**
 * Several TMDB people can share a name ("Dreyer", "Andrew Lau"). Try the top name
 * matches and keep the one whose filmography covers the most of this section.
 */
async function pickPerson(label, titles) {
  const res = await tmdb(`/search/person?query=${encodeURIComponent(label)}&include_adult=false`);
  const want = nameTokens(label);
  const cands = (res.results || []).filter((p) => {
    if (p.known_for_department !== "Directing") return false;
    const have = new Set(nameTokens(p.name));
    return want.every((t) => have.has(t));
  }).slice(0, 5);
  let best = null;
  for (const p of cands) {
    const credits = await filmography(p.id);
    await sleep(40);
    const idx = indexCredits(credits);
    const hits = titles.filter((t) => exactInFilmography(t, idx)).length;
    if (!best || hits > best.hits) best = { person: p, credits, hits };
  }
  return best;
}

async function filmography(personId) {
  const d = await tmdb(`/person/${personId}/combined_credits`);
  return (d.crew || [])
    .filter((c) => c.job === "Director" || (c.media_type === "tv" && c.department === "Directing"))
    .map((c) => ({
      id: c.id,
      media_type: c.media_type,
      title: c.title || c.name || "",
      original: c.original_title || c.original_name || "",
      vote_count: c.vote_count || 0,
      poster_path: c.poster_path,
    }));
}

// ---- matching -------------------------------------------------------------------------
function indexCredits(credits) {
  const byKey = new Map();
  const ids = new Map();
  for (const c of credits) {
    ids.set(`${c.media_type}:${c.id}`, c);
    for (const k of new Set([titleKey(c.title), titleKey(c.original)])) {
      if (!k) continue;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(c);
    }
  }
  return { byKey, ids };
}

const best = (list) => [...list].sort((a, b) =>
  (a.media_type === "movie" ? 0 : 1) - (b.media_type === "movie" ? 0 : 1) || b.vote_count - a.vote_count)[0];

async function matchInFilmography(title, idx) {
  const queries = candidateQueries(title);
  for (const q of queries) {
    const hits = idx.byKey.get(titleKey(q));
    if (hits?.length) return { hit: best(hits), method: "filmography" };
  }
  // TMDB's own fuzzy search, restricted to this director's films.
  for (const q of queries.slice(0, 2)) {
    const res = await tmdb(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false`);
    await sleep(40);
    const hit = (res.results || []).find((r) => idx.ids.has(`${r.media_type}:${r.id}`));
    if (hit) return { hit, method: "search+filmography" };
  }
  return null;
}

async function upsertSectionMatch(title, code, r, method) {
  await sql`
    INSERT INTO tmdb_section_match (title, movie_class, tmdb_title, tmdb_id, media_type, poster_path,
      backdrop_path, overview, release_year, genres, director, top_cast, vote_average, country, method, status, updated_at)
    VALUES (${title}, ${code}, ${r.tmdb_title}, ${r.tmdb_id}, ${r.media_type}, ${r.poster_path},
      ${r.backdrop_path}, ${r.overview}, ${r.release_year}, ${r.genres}, ${r.director}, ${r.top_cast},
      ${r.vote_average}, ${r.country}, ${method}, 'ok', now())
    ON CONFLICT (title, movie_class) DO UPDATE SET
      tmdb_title=EXCLUDED.tmdb_title, tmdb_id=EXCLUDED.tmdb_id, media_type=EXCLUDED.media_type,
      poster_path=EXCLUDED.poster_path, backdrop_path=EXCLUDED.backdrop_path, overview=EXCLUDED.overview,
      release_year=EXCLUDED.release_year, genres=EXCLUDED.genres, director=EXCLUDED.director,
      top_cast=EXCLUDED.top_cast, vote_average=EXCLUDED.vote_average, country=EXCLUDED.country,
      method=EXCLUDED.method, status='ok', updated_at=now()`;
}

async function titlesIn(code) {
  const rows = await sql`
    SELECT DISTINCT ${CLEAN} AS title FROM inventor
    WHERE movie_class = ${code} AND ${CLEAN} <> '' AND ${CLEAN} !~ '^\\('
    ORDER BY 1`;
  return rows.map((r) => r.title);
}

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ---- main -----------------------------------------------------------------------------
(async () => {
  await ensureTables();
  const overrides = loadOverrides();
  const refileOverrides = loadRefileOverrides();

  const sections = await sql`
    SELECT i.movie_class AS code, coalesce(max(c.class_des), i.movie_class) AS des,
           count(DISTINCT ${CLEAN})::int AS n
    FROM inventor i LEFT JOIN class c ON c.class = i.movie_class
    WHERE coalesce(i.movie_class, '') <> '' AND i.movie_class NOT IN ${sql(GENERIC)}
    GROUP BY i.movie_class HAVING count(DISTINCT ${CLEAN}) >= ${MIN_TITLES}
    ORDER BY n DESC`;
  console.log(`${sections.length} sections with >= ${MIN_TITLES} titles.`);

  // 1. Resolve directors for every section (needed for the report even with --section).
  const directorSections = new Map(); // code -> { label, people:[{id,name}], idx }
  for (const s of sections) {
    const label = cleanLabel(s.des);
    let people = [];
    let credits = [];
    try {
      if (overrides[s.code]) {
        for (const n of overrides[s.code]) {
          const p = await overridePerson(n);
          if (p) people.push(p); else console.warn(`  override "${n}" for ${s.code} not found on TMDB`);
          await sleep(40);
        }
        for (const p of people) { credits.push(...(await filmography(p.id))); await sleep(40); }
      } else if (!(s.code in overrides)) {
        const best = await pickPerson(label, await titlesIn(s.code));
        if (best) { people = [best.person]; credits = best.credits; }
      }
      if (!people.length) continue;
      directorSections.set(s.code, { label, n: s.n, people, idx: indexCredits(credits) });
    } catch (e) {
      console.error(`  ${s.code} (${label}): ${e.message}`);
    }
  }
  console.log(`${directorSections.size} candidate director sections.`);

  // 2. Match titles against the filmography; keep the section only if enough matches.
  const matchedTitles = new Map(); // code -> Set(title)
  for (const [code, ds] of directorSections) {
    const titles = await titlesIn(code);
    const results = [];
    for (const t of titles) {
      try {
        const m = await matchInFilmography(t, ds.idx);
        if (m) results.push({ title: t, ...m });
      } catch (e) {
        console.error(`  ${code} "${t}": ${e.message}`);
      }
    }
    const share = titles.length ? results.length / titles.length : 0;
    const isDirector = code in overrides || (results.length >= Math.min(MIN_MATCHED, titles.length) && share >= MIN_SHARE);
    const who = ds.people.map((p) => p.name).join(" & ");
    if (!isDirector) {
      console.log(`  skip ${code} (${ds.label}): only ${results.length}/${titles.length} by ${who}`);
      directorSections.delete(code);
      continue;
    }
    matchedTitles.set(code, new Set(results.map((r) => r.title)));
    if (ONLY.length && !ONLY.includes(code)) continue; // report-only for this section
    for (const r of results) {
      const row = await buildRow(tmdb, r.hit);
      await upsertSectionMatch(r.title, code, row, r.method);
      await sleep(40);
    }
    console.log(`  ${code} (${ds.label} = ${who}): matched ${results.length}/${titles.length}`);
  }

  // 3. Report items in a director section that aren't by that director.
  const byDirectorName = new Map(); // titleKey(person) -> code
  for (const [code, ds] of directorSections) for (const p of ds.people) byDirectorName.set(titleKey(p.name), code);

  const outDir = path.join(HERE, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const lines = [["section", "section_label", "store_title", "generic_match", "generic_year", "generic_director", "action", "suggested_section", "suggested_label"].join(",")];
  const reassign = [];
  for (const [code, ds] of directorSections) {
    if (ONLY.length && !ONLY.includes(code)) continue;
    const matched = matchedTitles.get(code) || new Set();
    const titles = (await titlesIn(code)).filter((t) => !matched.has(t));
    if (!titles.length) continue;
    const generic = await sql`SELECT title, tmdb_title, release_year, director FROM tmdb_cache WHERE title IN ${sql(titles)}`;
    const g = new Map(generic.map((r) => [r.title, r]));
    for (const t of titles) {
      const r = g.get(t);
      const dirs = (r?.director || "").split(",").map((x) => titleKey(x)).filter(Boolean);
      const key = `${code}|${t}`;
      let target = dirs.map((d) => byDirectorName.get(d)).find((c) => c && c !== code);
      let action;
      if (key in refileOverrides) {
        target = refileOverrides[key] && directorSections.has(refileOverrides[key]) ? refileOverrides[key] : null;
        action = target ? "refile (override)" : "keep (override)";
      } else if (target && !exactInFilmography(t, directorSections.get(target).idx)) {
        // Generic match looks like a different film (e.g. THE DARK -> The Dark Knight).
        target = null;
        action = "review";
      } else {
        action = target ? "refile" : r?.director ? "review" : "unmatched";
      }
      if (target) reassign.push({ title: t, from: code, to: target,
        reason: action === "refile" ? `generic match directed by ${r.director}` : "manual override" });
      lines.push([code, ds.label, t, r?.tmdb_title, r?.release_year, r?.director, action, target || "",
        target ? directorSections.get(target).label : ""].map(csvCell).join(","));
    }
  }
  const reportPath = path.join(outDir, "section_report.csv");
  fs.writeFileSync(reportPath, lines.join("\n") + "\n");
  console.log(`\nReport: ${path.relative(process.cwd(), reportPath)} (${lines.length - 1} rows, ${reassign.length} suggested re-filings)`);

  // 4. Apply re-filings and match those titles within their new section.
  if (APPLY && reassign.length) {
    for (const r of reassign) {
      await sql`
        INSERT INTO section_reassign (title, from_class, to_class, reason, updated_at)
        VALUES (${r.title}, ${r.from}, ${r.to}, ${r.reason}, now())
        ON CONFLICT (title, from_class) DO UPDATE SET to_class=EXCLUDED.to_class, reason=EXCLUDED.reason, updated_at=now()`;
      const ds = directorSections.get(r.to);
      const m = await matchInFilmography(r.title, ds.idx);
      if (m) { await upsertSectionMatch(r.title, r.to, await buildRow(tmdb, m.hit), m.method); await sleep(40); }
    }
    console.log(`Applied ${reassign.length} re-filings to section_reassign.`);
  } else if (reassign.length) {
    console.log("Dry run for re-filings: review the report, then re-run with --apply.");
  }
  await sql.end();
})();
