// Shared helpers for the TMDB batch scripts (tmdb_match.mjs, tmdb_section_match.mjs).

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** TMDB client using TMDB_READ_TOKEN (v4 bearer) or TMDB_API_KEY (v3). */
export function makeTmdb({ token, apiKey }) {
  const base = "https://api.themoviedb.org/3";
  const headers = token ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" };
  const withKey = (u) => (apiKey ? `${u}${u.includes("?") ? "&" : "?"}api_key=${apiKey}` : u);
  return async function tmdb(path) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(withKey(`${base}${path}`), { headers });
      if (res.status === 429) {
        await sleep(Number(res.headers.get("retry-after") || 2) * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
      return res.json();
    }
    throw new Error(`TMDB rate-limited repeatedly for ${path}`);
  };
}

/** Same cleaned-title expression the app groups/joins on (keep in sync with queries.ts). */
export const cleanExpr = (sql) => sql`btrim(regexp_replace(item_title, '^AVAIL?([[:space:][:punct:]]+|$)', '', 'i'))`;

// Normalize a catalog title into a searchable show/movie name: reorder a trailing
// article and strip season/disc/volume/part/edition suffixes.
export function normalizeTitle(title) {
  let s = title.trim().replace(/^AVAIL?(?:[\s\p{P}]+|$)/iu, "").trim() || title.trim();
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

// Remove edition/qualifier tags and parentheticals that block a match.
export function stripQualifiers(s) {
  return s
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s*\([^)]*$/, " ") // unclosed trailing "(...", e.g. "(MINI-SERIE"
    .replace(
      /\b(CRITERION|COLLECTION|COLL|SPEC(?:IAL)?\s?ED(?:ITION)?|S\.E\.?|UNRATED|UNCUT|REMASTER(?:ED)?|ANNIVERSARY|DELUXE|LIMITED|EXTENDED(?:\s+CUT)?|DIRECTOR'?S?\s+CUT|BOX\s?SET|TRILOGY|COMPLETE)\b.*$/i,
      ""
    )
    .replace(/[-:]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Ordered query variants, most specific first.
export function candidateQueries(title) {
  const out = [];
  const push = (s) => {
    const v = (s || "").replace(/\s{2,}/g, " ").trim();
    if (v && !out.includes(v)) out.push(v);
  };
  const base = normalizeTitle(title);
  push(stripQualifiers(base));
  push(base);
  if (title.includes("/")) push(stripQualifiers(normalizeTitle(title.split("/")[0]))); // double feature
  const aka = title.split(/\s+aka\s+/i);
  if (aka.length > 1) { push(stripQualifiers(normalizeTitle(aka[0]))); push(stripQualifiers(normalizeTitle(aka[1]))); }
  const c = stripQualifiers(base);
  if (c.includes(":")) push(c.split(":")[0]);
  return out;
}

/** Loose comparison key: lowercase, no accents/punctuation/leading article, & -> and. */
export function titleKey(s) {
  return String(s || "")
    .normalize("NFD").replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build a cache row from a search hit ({id, media_type, ...}) plus its details call. */
export async function buildRow(tmdb, hit) {
  const isTv = hit.media_type === "tv";
  let d = null;
  try {
    d = await tmdb(`/${isTv ? "tv" : "movie"}/${hit.id}?append_to_response=credits`);
  } catch { /* keep search-level data */ }
  const src = d || hit;
  const name = (isTv ? src.name : src.title) || null;
  const date = isTv ? src.first_air_date : src.release_date;
  return {
    status: "ok",
    tmdb_id: hit.id,
    tmdb_title: name,
    media_type: hit.media_type,
    poster_path: src.poster_path ?? null,
    backdrop_path: src.backdrop_path ?? null,
    overview: src.overview || null,
    release_year: date ? Number(String(date).slice(0, 4)) || null : null,
    genres: d ? (d.genres || []).map((g) => g.name).join(", ") || null : null,
    director: d
      ? isTv
        ? (d.created_by || []).map((c) => c.name).join(", ") || null
        : (d.credits?.crew || []).find((c) => c.job === "Director")?.name ?? null
      : null,
    top_cast: d ? (d.credits?.cast || []).slice(0, 4).map((c) => c.name).join(", ") || null : null,
    vote_average: src.vote_average ?? null,
    country: d ? (d.production_countries || [])[0]?.name || null : null,
  };
}
