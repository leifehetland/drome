# Videodrome ATL — full-stack setup

Next.js 16 (App Router) app with a Postgres-backed API and role-based auth, all in
one deploy. Data comes from the migrated vmtvid tables.

## Stack

- **DB access:** Drizzle ORM over `postgres` (postgres.js) — `src/db/`
- **Auth:** Auth.js / NextAuth v5, Credentials + JWT sessions, roles `admin` / `staff` / `member`
- **API:** Route Handlers under `src/app/api/`
- **Protected routes:** `src/middleware.ts` guards `/admin` (staff+admin) and `/account` (any signed-in user)

## One-time database setup

Point at the same Postgres database that holds the export (local, Supabase, or Neon):

```bash
# 1. core tables (customer, inventory, lookups) + readable date columns
psql "$DATABASE_URL" -f ../db_test/vmtvid_export.sql          # loads all 17 tables
# (if staying under a 500 MB tier, drop history and use the trimmed slice instead:)
#   psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS cas_hist, cus_hist CASCADE;"
#   psql "$DATABASE_URL" -f ../db_test/history_recent.sql     # 2014+ slice (~185 MB in PG)
psql "$DATABASE_URL" -f ../db_test/add_clarion_date_columns_core.sql  # core date columns

# 2. auth table
psql "$DATABASE_URL" -f ../db_test/app_users.sql
```

The trimmed `history_recent.sql` recreates `cas_hist`/`cus_hist` with only 2014-2020
rows (plus its own date columns), so the whole database fits a free tier with room to
spare while still demoing rental history.

## TMDB enrichment (posters, overviews, genres, cast)

The catalog is enriched from TMDB via a cache table filled by a one-time batch script.

```bash
# 1. create the cache table
psql "$DATABASE_URL" -f ../db_test/tmdb_cache.sql

# 2. batch-match every catalog title (resumable; ~15–25 min for the full catalog)
cd videodrome_atl
DATABASE_URL="..." TMDB_READ_TOKEN="..." node scripts/tmdb_match.mjs
#   --limit=200   test run on the first 200 titles
#   --retry       re-attempt titles previously marked nomatch/error
```

Set the TMDB credential to whichever your account gives you: `TMDB_READ_TOKEN`
(long v4 token, Bearer) or `TMDB_API_KEY` (short v3 key). Poster images load from
TMDB's public CDN, so no key is exposed to the browser. Re-run any time to pick up
new inventory; already-matched titles are skipped.

## Configure and run

```bash
cp .env.example .env         # set DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)
npm install
npm run seed                 # creates admin@videodrome.local / member@videodrome.local
npm run dev
```

Seed passwords default to `changeme-admin` / `changeme-member` — override with
`ADMIN_PASSWORD=… MEMBER_PASSWORD=… npm run seed`.

## Routes

| route | access | what |
|---|---|---|
| `/films` | public | catalog browse: category-row landing, grid/list toggle, search by title/director-genre/format/rating, pagination, TMDB posters |
| `/films/detail?t=` | public | film detail: poster, overview, genres, cast + store copies/formats/location |
| `/api/films?q=&category=&format=&rating=&limit=&offset=` | public | JSON catalog search with total count |
| `/login` | public | credentials sign-in |
| `/account` | signed-in | profile + role |
| `/account/rentals` | signed-in | member's rental history (cus_hist joined to titles) |
| `/admin` | staff / admin | customer lookup over the migrated `customer` table |

The seeded demo member is linked to customer `166900` (a real account with rich
2014-2020 history) so `/account/rentals` has data to show. Override with
`DEMO_CUSTOMER_ID=… npm run seed`.

## Roles

`app_users.role` drives access. Members link to a legacy customer via
`app_users.customer_id → customer.cust_id`. Enforcement lives in the `authorized`
callback in `src/auth.config.ts` (used by middleware) — add new protected prefixes there.

## Notes

- **Fonts:** `layout.tsx` uses `next/font/google` (Geist); the build fetches them, so
  build with internet access.
- **Middleware:** Next 16 prints a deprecation notice suggesting the new `proxy.ts`
  convention. `middleware.ts` still works; rename later if you want to silence it.
- **Pooled hosts:** the client sets `prepare:false`, so a Supabase/Neon transaction
  pooler URL works as-is.
