import { sql } from "drizzle-orm";
import { db } from "./index";
import type { TmdbDetails } from "@/lib/tmdb";

/** TMDB image helper (poster paths are public; safe on the client). */
export function posterUrl(path: string | null | undefined, size = "w342") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

/** Letterboxd deep-link by TMDB id (movies only; TV isn't supported by Letterboxd). */
export function letterboxdUrl(tmdbId: number | null | undefined, mediaType: string | null | undefined) {
  return tmdbId && mediaType === "movie" ? `https://letterboxd.com/tmdb/${tmdbId}` : null;
}

// Cleaned catalog title: strip the "AVAIL"/"AVAI" placeholder prefix in all its
// forms — "AVAIL ", "AVAIL-", "AVAIL--", "AVAIL;", "Avail", "AVAI", etc. Requires a
// separator (or end of string) after the token so real words like "AVAILABLE" survive.
// The WHERE clause then drops the now-empty bare placeholders and paren-only rows.
const CLEAN = sql`btrim(regexp_replace(item_title, '^AVAIL?([[:space:][:punct:]]+|$)', '', 'i'))`;
const VALID = sql`${CLEAN} <> '' AND ${CLEAN} !~ '^\\('`;
// Group key: collapse copies/discs that resolved to the same TMDB film/show into one
// entry; unmatched titles group by their own cleaned title.
const GKEY = sql`coalesce(t.tmdb_id::text, ${CLEAN})`;

export type FilmRow = {
  title: string;
  formats: string | null;
  total_copies: number;
  rate: string | null;
  movie_class: string | null;
  tmdb_id: number | null;
  poster_path: string | null;
  release_year: number | null;
  genres: string | null;
  director: string | null;
  variants: number; // distinct catalog titles collapsed into this entry (discs/editions)
};

export type FilmSort = "title" | "year" | "rating";

export type FilmFilters = {
  q?: string;
  category?: string; // movie_class code (store "section")
  format?: string; // movie_format
  rating?: string; // movie_rate
  genre?: string; // TMDB genre (substring of comma list)
  decade?: string; // e.g. "1990" => 1990-1999
  director?: string; // TMDB director (substring)
  sort?: FilmSort;
  limit?: number;
  offset?: number;
};

function textFilter(f: FilmFilters, fuzzy: boolean) {
  if (!f.q) return null;
  const q = f.q.trim();
  const like = `%${q}%`;
  // Fuzzy: trigram similarity on title (typo-tolerant) OR substring across people/overview.
  // Fallback: substring only (works without the pg_trgm extension).
  return fuzzy
    ? sql`(${CLEAN} % ${q} OR ${CLEAN} ILIKE ${like} OR t.director ILIKE ${like}
           OR t.top_cast ILIKE ${like} OR t.overview ILIKE ${like})`
    : sql`(${CLEAN} ILIKE ${like} OR t.director ILIKE ${like}
           OR t.top_cast ILIKE ${like} OR t.overview ILIKE ${like})`;
}

function whereClause(f: FilmFilters, fuzzy: boolean) {
  const parts = [VALID];
  const tf = textFilter(f, fuzzy);
  if (tf) parts.push(tf);
  if (f.category) parts.push(sql`movie_class = ${f.category}`);
  if (f.format) parts.push(sql`movie_format = ${f.format}`);
  if (f.rating) parts.push(sql`movie_rate = ${f.rating}`);
  if (f.genre) parts.push(sql`t.genres ILIKE ${"%" + f.genre + "%"}`);
  if (f.director) parts.push(sql`t.director ILIKE ${"%" + f.director.trim() + "%"}`);
  if (f.decade) {
    const d = parseInt(f.decade, 10);
    if (!Number.isNaN(d)) parts.push(sql`t.release_year BETWEEN ${d} AND ${d + 9}`);
  }
  return sql.join(parts, sql` AND `);
}

// All non-aggregated columns must be aggregated here since we GROUP BY the TMDB key,
// not the title.
function orderClause(f: FilmFilters, fuzzy: boolean) {
  if (f.sort === "year") return sql`max(t.release_year) DESC NULLS LAST, min(${CLEAN})`;
  if (f.sort === "rating") return sql`max(t.vote_average) DESC NULLS LAST, min(${CLEAN})`;
  if (f.q && fuzzy) return sql`max(similarity(${CLEAN}, ${f.q.trim()})) DESC, min(${CLEAN})`;
  return sql`min(${CLEAN})`;
}

// pg_trgm missing -> Postgres 42883 (undefined function/operator). Fall back to substring.
function isMissingTrgm(err: unknown) {
  return (err as { code?: string })?.code === "42883";
}

async function runGetFilms(f: FilmFilters, fuzzy: boolean) {
  const limit = Math.min(Math.max(f.limit ?? 48, 1), 200);
  const offset = Math.max(f.offset ?? 0, 0);
  const rows = await db.execute<FilmRow>(sql`
    SELECT min(${CLEAN}) AS title,
           string_agg(DISTINCT movie_format, ',') FILTER (WHERE movie_format <> '') AS formats,
           sum(GREATEST(coalesce(quantity, 0), 0))::float8 AS total_copies,
           max(movie_rate)  AS rate,
           max(movie_class) AS movie_class,
           max(t.tmdb_id)      AS tmdb_id,
           max(t.poster_path)  AS poster_path,
           max(t.release_year) AS release_year,
           max(t.genres)       AS genres,
           max(t.director)     AS director,
           count(DISTINCT ${CLEAN})::int AS variants
    FROM inventor i
    LEFT JOIN tmdb_cache t ON t.title = ${CLEAN}
    WHERE ${whereClause(f, fuzzy)}
    GROUP BY ${GKEY}
    ORDER BY ${orderClause(f, fuzzy)}
    LIMIT ${limit} OFFSET ${offset}
  `);
  return rows as unknown as FilmRow[];
}

export async function getFilms(f: FilmFilters = {}) {
  try {
    return await runGetFilms(f, true);
  } catch (err) {
    if (isMissingTrgm(err)) return runGetFilms(f, false);
    throw err;
  }
}

async function runCountFilms(f: FilmFilters, fuzzy: boolean) {
  const rows = await db.execute<{ n: number }>(sql`
    SELECT count(*) AS n FROM (
      SELECT 1 FROM inventor i
      LEFT JOIN tmdb_cache t ON t.title = ${CLEAN}
      WHERE ${whereClause(f, fuzzy)} GROUP BY ${GKEY}
    ) s
  `);
  const r = rows as unknown as { n: number }[];
  return Number(r[0]?.n ?? 0);
}

export async function countFilms(f: FilmFilters = {}) {
  try {
    return await runCountFilms(f, true);
  } catch (err) {
    if (isMissingTrgm(err)) return runCountFilms(f, false);
    throw err;
  }
}

export async function getGenres(): Promise<string[]> {
  const rows = await db.execute<{ genre: string }>(sql`
    SELECT DISTINCT btrim(g) AS genre
    FROM tmdb_cache, unnest(string_to_array(coalesce(genres, ''), ',')) g
    WHERE status = 'ok' AND btrim(g) <> ''
    ORDER BY genre`);
  return (rows as unknown as { genre: string }[]).map((r) => r.genre);
}

export async function getDecades(): Promise<number[]> {
  const rows = await db.execute<{ decade: number }>(sql`
    SELECT DISTINCT (floor(release_year / 10) * 10)::int AS decade
    FROM tmdb_cache
    WHERE release_year BETWEEN 1900 AND 2100
    ORDER BY decade DESC`);
  return (rows as unknown as { decade: number }[]).map((r) => Number(r.decade));
}

export type Category = { code: string; label: string; count: number };

/** Store classes (director/genre taxonomy) with catalog counts. */
export async function getCategories(minCount = 8, limit = 300): Promise<Category[]> {
  const rows = await db.execute<Category>(sql`
    SELECT i.movie_class AS code,
           coalesce(max(c.class_des), i.movie_class) AS label,
           count(DISTINCT ${CLEAN}) AS count
    FROM inventor i
    LEFT JOIN class c ON c.class = i.movie_class
    WHERE ${VALID} AND coalesce(i.movie_class, '') <> ''
    GROUP BY i.movie_class
    HAVING count(DISTINCT ${CLEAN}) >= ${minCount}
    ORDER BY count(DISTINCT ${CLEAN}) DESC
    LIMIT ${limit}
  `);
  return (rows as unknown as Category[]).map((r) => ({ ...r, count: Number(r.count) }));
}

export async function getFormats(): Promise<string[]> {
  const rows = await db.execute<{ f: string }>(sql`
    SELECT DISTINCT movie_format AS f FROM inventor
    WHERE coalesce(movie_format,'') <> '' ORDER BY movie_format`);
  return (rows as unknown as { f: string }[]).map((r) => r.f);
}

export async function getRatings(): Promise<string[]> {
  const rows = await db.execute<{ r: string }>(sql`
    SELECT DISTINCT movie_rate AS r FROM inventor
    WHERE coalesce(movie_rate,'') <> '' ORDER BY movie_rate`);
  return (rows as unknown as { r: string }[]).map((x) => x.r);
}

/** Films within a category, poster-first — for the landing carousels. */
export async function getFilmsByCategory(code: string, limit = 20) {
  const rows = await db.execute<FilmRow>(sql`
    SELECT min(${CLEAN}) AS title,
           string_agg(DISTINCT movie_format, ',') FILTER (WHERE movie_format <> '') AS formats,
           sum(GREATEST(coalesce(quantity, 0), 0))::float8 AS total_copies,
           max(movie_rate) AS rate, max(movie_class) AS movie_class,
           max(t.tmdb_id) AS tmdb_id, max(t.poster_path) AS poster_path,
           max(t.release_year) AS release_year, max(t.genres) AS genres, max(t.director) AS director,
           count(DISTINCT ${CLEAN})::int AS variants
    FROM inventor i
    LEFT JOIN tmdb_cache t ON t.title = ${CLEAN}
    WHERE ${VALID} AND movie_class = ${code}
    GROUP BY ${GKEY}
    ORDER BY (max(t.poster_path) IS NOT NULL) DESC, max(t.vote_average) DESC NULLS LAST, min(${CLEAN})
    LIMIT ${limit}
  `);
  return rows as unknown as FilmRow[];
}

export type FilmDetail = FilmRow & {
  media_type: string | null;
  overview: string | null;
  backdrop_path: string | null;
  top_cast: string | null;
  vote_average: number | null;
  item_types: string | null;
  locations: string | null;
  edition_titles: string | null; // the individual catalog titles collapsed here
  extra_tmdb_ids: string | null;
};

function detailSelect(whereExpr: ReturnType<typeof sql>, groupExpr: ReturnType<typeof sql>) {
  return sql`
    SELECT min(${CLEAN}) AS title,
           string_agg(DISTINCT movie_format, ',') FILTER (WHERE movie_format <> '') AS formats,
           string_agg(DISTINCT item_type, ',') FILTER (WHERE item_type <> '') AS item_types,
           string_agg(DISTINCT location, ',')  FILTER (WHERE coalesce(location,'') <> '') AS locations,
           string_agg(DISTINCT ${CLEAN}, ' · ') AS edition_titles,
           count(DISTINCT ${CLEAN})::int AS variants,
           sum(GREATEST(coalesce(quantity, 0), 0))::float8 AS total_copies,
           max(movie_rate) AS rate, max(movie_class) AS movie_class,
           max(t.tmdb_id) AS tmdb_id, max(t.media_type) AS media_type,
           max(t.poster_path) AS poster_path, max(t.backdrop_path) AS backdrop_path,
           max(t.release_year) AS release_year, max(t.genres) AS genres, max(t.director) AS director,
           max(t.top_cast) AS top_cast, max(t.overview) AS overview, max(t.vote_average) AS vote_average,
           max(t.extra_tmdb_ids) AS extra_tmdb_ids
    FROM inventor i
    LEFT JOIN tmdb_cache t ON t.title = ${CLEAN}
    WHERE ${VALID} AND ${whereExpr}
    GROUP BY ${groupExpr}
    LIMIT 1`;
}

export async function getFilmDetail(title: string): Promise<FilmDetail | null> {
  const rows = await db.execute<FilmDetail>(detailSelect(sql`${CLEAN} = ${title}`, CLEAN));
  return (rows as unknown as FilmDetail[])[0] ?? null;
}

export async function getFilmDetailById(tmdbId: number): Promise<FilmDetail | null> {
  const rows = await db.execute<FilmDetail>(detailSelect(sql`t.tmdb_id = ${tmdbId}`, sql`t.tmdb_id`));
  return (rows as unknown as FilmDetail[])[0] ?? null;
}

// ---- TMDB coverage / triage --------------------------------------------------------

export async function getTmdbCoverage() {
  const rows = await db.execute<{ status: string; n: number }>(sql`
    SELECT status, count(*) AS n FROM tmdb_cache GROUP BY status`);
  const r = rows as unknown as { status: string; n: number }[];
  const by: Record<string, number> = {};
  let total = 0;
  for (const x of r) { by[x.status] = Number(x.n); total += Number(x.n); }
  return { total, ok: by.ok ?? 0, nomatch: by.nomatch ?? 0, error: by.error ?? 0 };
}

export type NomatchRow = { title: string; status: string };

export async function listNomatches(q: string | undefined, limit: number, offset: number) {
  const like = q ? `%${q.trim()}%` : null;
  const rows = await db.execute<NomatchRow>(sql`
    SELECT title, status FROM tmdb_cache
    WHERE status IN ('nomatch', 'error')
      ${like ? sql`AND title ILIKE ${like}` : sql``}
    ORDER BY title
    LIMIT ${Math.min(limit, 200)} OFFSET ${Math.max(offset, 0)}`);
  const countRows = await db.execute<{ n: number }>(sql`
    SELECT count(*) AS n FROM tmdb_cache
    WHERE status IN ('nomatch', 'error') ${like ? sql`AND title ILIKE ${like}` : sql``}`);
  const c = countRows as unknown as { n: number }[];
  return { rows: rows as unknown as NomatchRow[], total: Number(c[0]?.n ?? 0) };
}

export async function applyTmdbMatch(title: string, d: TmdbDetails) {
  await db.execute(sql`
    UPDATE tmdb_cache SET
      tmdb_id=${d.tmdbId}, media_type=${d.mediaType}, poster_path=${d.posterPath},
      backdrop_path=${d.backdropPath}, overview=${d.overview}, release_year=${d.releaseYear},
      genres=${d.genres}, director=${d.director}, top_cast=${d.topCast},
      vote_average=${d.voteAverage}, status='ok', updated_at=now()
    WHERE title=${title}`);
}

// ---- existing member/admin queries -------------------------------------------------

export type RentalHistoryRow = {
  rentid: string;
  title: string | null;
  item_type: string | null;
  rented: string | null;
  returned: string | null;
  price: number | null;
};

export async function getCustomerRentals(customerId: string, limit = 100) {
  try {
    const result = await db.execute<RentalHistoryRow>(sql`
      SELECT h.rentid, i.item_title AS title, h.item_type,
             h.date_rented_dt AS rented, h.date_returnd_dt AS returned, h.price
      FROM cus_hist h
      LEFT JOIN inventor i ON i.item_no = h.rentid
      WHERE h.cust_id = ${customerId}
      ORDER BY h.date_rented DESC NULLS LAST
      LIMIT ${Math.min(limit, 500)}
    `);
    return result as unknown as RentalHistoryRow[];
  } catch {
    return [];
  }
}

export type CustomerRow = {
  cust_id: string;
  last_name: string | null;
  first_name: string | null;
  email_1: string | null;
  home_phone: string | null;
  status: string | null;
};

export async function searchCustomers(q: string, limit = 50) {
  const like = `%${q.trim()}%`;
  const result = await db.execute<CustomerRow>(sql`
    SELECT cust_id, last_name, first_name, email_1, home_phone, status
    FROM customer
    WHERE last_name ILIKE ${like} OR first_name ILIKE ${like} OR email_1 ILIKE ${like} OR cust_id ILIKE ${like}
    ORDER BY last_name, first_name
    LIMIT ${Math.min(limit, 200)}
  `);
  return result as unknown as CustomerRow[];
}
