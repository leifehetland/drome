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
# 1. legacy data (from earlier work)
psql "$DATABASE_URL" -f ../db_test/vmtvid_export.sql
psql "$DATABASE_URL" -f ../db_test/add_clarion_date_columns.sql   # optional: readable dates

# 2. auth table
psql "$DATABASE_URL" -f ../db_test/app_users.sql
```

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
| `/films` | public | catalog, rolled up by title, live from `inventor` |
| `/api/films?q=` | public | JSON catalog search |
| `/login` | public | credentials sign-in |
| `/account` | signed-in | profile + role |
| `/admin` | staff / admin | customer lookup over the migrated `customer` table |

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
