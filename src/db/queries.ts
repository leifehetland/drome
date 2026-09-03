import { sql } from "drizzle-orm";
import { db } from "./index";

/** TMDB image helper (poster paths are public; safe on the client). */
export function posterUrl(path: string | null | undefined, size = "w342") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

// Cleaned catalog title: strip the "AVAIL " prefix; the WHERE clauses drop the
// bare "AVAIL" placeholders and parenthetical-only rows.
const CLEAN = sql`btrim(regexp_replace(item_title, '^AVAIL[[:space:]]+', '', 'i'))`;
const VALID = sql`upper(btrim(item_title)) <> 'AVAIL' AND ${CLEAN} <> '' AND ${CLEAN} !~ '^\\('`;

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
};

export type FilmFilters = {
  q?: string;
  category?: string; // movie_class code
  format?: string; // movie_format
  rating?: string; // movie_rate
  limit?: number;
  offset?: number;
};

function whereClause(f: FilmFilters) {
  const parts = [VALID];
  if (f.q) parts.push(sql`${CLEAN} ILIKE ${"%" + f.q.trim() + "%"}`);
  if (f.category) parts.push(sql`movie_class = ${f.category}`);
  if (f.format) parts.push(sql`movie_format = ${f.format}`);
  if (f.rating) parts.push(sql`movie_rate = ${f.rating}`);
  return sql.join(parts, sql` AND `);
}

export async function getFilms(f: FilmFilters = {}) {
  const limit = Math.min(Math.max(f.limit ?? 48, 1), 200);
  const offset = Math.max(f.offset ?? 0, 0);
  const rows = await db.execute<FilmRow>(sql`
    SELECT ${CLEAN} AS title,
           string_agg(DISTINCT movie_format, ',') FILTER (WHERE movie_format <> '') AS formats,
           sum(GREATEST(coalesce(quantity, 0), 0)) AS total_copies,
           max(movie_rate)  AS rate,
           max(movie_class) AS movie_class,
           max(t.tmdb_id)      AS tmdb_id,
           max(t.poster_path)  AS poster_path,
           max(t.release_year) AS release_year,
           max(t.genres)       AS genres,
           max(t.director)     AS director
    FROM inventor i
    LEFT JOIN tmdb_cache t ON t.title = ${CLEAN}
    WHERE ${whereClause(f)}
    GROUP BY ${CLEAN}
    ORDER BY ${CLEAN}
    LIMIT ${limit} OFFSET ${offset}
  `);
  return rows as unknown as FilmRow[];
}

export async function countFilms(f: FilmFilters = {}) {
  const rows = await db.execute<{ n: number }>(sql`
    SELECT count(*) AS n FROM (
      SELECT 1 FROM inventor i WHERE ${whereClause(f)} GROUP BY ${CLEAN}
    ) s
  `);
  const r = rows as unknown as { n: number }[];
  return Number(r[0]?.n ?? 0);
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
    ORDER BY count DESC
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
    SELECT ${CLEAN} AS title,
           string_agg(DISTINCT movie_format, ',') FILTER (WHERE movie_format <> '') AS formats,
           sum(GREATEST(coalesce(quantity, 0), 0)) AS total_copies,
           max(movie_rate) AS rate, max(movie_class) AS movie_class,
           max(t.tmdb_id) AS tmdb_id, max(t.poster_path) AS poster_path,
           max(t.release_year) AS release_year, max(t.genres) AS genres, max(t.director) AS director
    FROM inventor i
    LEFT JOIN tmdb_cache t ON t.title = ${CLEAN}
    WHERE ${VALID} AND movie_class = ${code}
    GROUP BY ${CLEAN}
    ORDER BY (max(t.poster_path) IS NOT NULL) DESC, max(t.vote_average) DESC NULLS LAST, ${CLEAN}
    LIMIT ${limit}
  `);
  return rows as unknown as FilmRow[];
}

export type FilmDetail = FilmRow & {
  overview: string | null;
  backdrop_path: string | null;
  top_cast: string | null;
  vote_average: number | null;
  item_types: string | null;
  locations: string | null;
};

export async function getFilmDetail(title: string): Promise<FilmDetail | null> {
  const rows = await db.execute<FilmDetail>(sql`
    SELECT ${CLEAN} AS title,
           string_agg(DISTINCT movie_format, ',') FILTER (WHERE movie_format <> '') AS formats,
           string_agg(DISTINCT item_type, ',') FILTER (WHERE item_type <> '') AS item_types,
           string_agg(DISTINCT location, ',')  FILTER (WHERE coalesce(location,'') <> '') AS locations,
           sum(GREATEST(coalesce(quantity, 0), 0)) AS total_copies,
           max(movie_rate) AS rate, max(movie_class) AS movie_class,
           max(t.tmdb_id) AS tmdb_id, max(t.poster_path) AS poster_path, max(t.backdrop_path) AS backdrop_path,
           max(t.release_year) AS release_year, max(t.genres) AS genres, max(t.director) AS director,
           max(t.top_cast) AS top_cast, max(t.overview) AS overview, max(t.vote_average) AS vote_average
    FROM inventor i
    LEFT JOIN tmdb_cache t ON t.title = ${CLEAN}
    WHERE ${VALID} AND ${CLEAN} = ${title}
    GROUP BY ${CLEAN}
    LIMIT 1
  `);
  const r = rows as unknown as FilmDetail[];
  return r[0] ?? null;
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
