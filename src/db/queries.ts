import { sql } from "drizzle-orm";
import { db } from "./index";

export type FilmRow = {
  title: string;
  class: string | null;
  rate: string | null;
  formats: string | null;
  total_copies: number;
  lines: number;
};

/** Catalog listing: inventory rolled up by title (each physical copy is a row). */
export async function getFilms(opts: { q?: string; limit?: number; offset?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const q = opts.q?.trim();
  const like = q ? `%${q}%` : null;

  const result = await db.execute<FilmRow>(sql`
    SELECT item_title AS title,
           max(movie_class)                     AS class,
           max(movie_rate)                      AS rate,
           string_agg(DISTINCT movie_format, ',') FILTER (WHERE movie_format <> '') AS formats,
           sum(GREATEST(coalesce(quantity, 0), 0)) AS total_copies,
           count(*)                             AS lines
    FROM inventor
    WHERE coalesce(inactive, 0) = 0
      AND item_title IS NOT NULL AND item_title <> ''
      ${like ? sql`AND item_title ILIKE ${like}` : sql``}
    GROUP BY item_title
    ORDER BY item_title
    LIMIT ${limit} OFFSET ${offset}
  `);

  return result as unknown as FilmRow[];
}

export type CustomerRow = {
  cust_id: string;
  last_name: string | null;
  first_name: string | null;
  email_1: string | null;
  home_phone: string | null;
  status: string | null;
};

export type RentalHistoryRow = {
  rentid: string;
  title: string | null;
  item_type: string | null;
  rented: string | null; // date
  returned: string | null; // date
  price: number | null;
};

/**
 * A member's rental history (recent first), joined to inventory titles.
 * Reads the cus_hist slice; returns [] if the history table isn't loaded.
 */
export async function getCustomerRentals(customerId: string, limit = 100) {
  try {
    const result = await db.execute<RentalHistoryRow>(sql`
      SELECT h.rentid,
             i.item_title AS title,
             h.item_type,
             h.date_rented_dt  AS rented,
             h.date_returnd_dt AS returned,
             h.price
      FROM cus_hist h
      LEFT JOIN inventor i ON i.item_no = h.rentid
      WHERE h.cust_id = ${customerId}
      ORDER BY h.date_rented DESC NULLS LAST
      LIMIT ${Math.min(limit, 500)}
    `);
    return result as unknown as RentalHistoryRow[];
  } catch {
    // history slice not loaded (e.g. core-only deploy)
    return [];
  }
}

/** Admin: search the migrated customer list. */
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
