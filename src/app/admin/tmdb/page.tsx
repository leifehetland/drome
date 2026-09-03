import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getTmdbCoverage, listNomatches, applyTmdbMatch } from "@/db/queries";
import { fetchTmdbDetails, tmdbConfigured } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

async function fixMatch(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "");
  const id = Number(formData.get("tmdb_id"));
  const mediaType = (String(formData.get("media_type")) === "tv" ? "tv" : "movie") as "movie" | "tv";
  if (!title || !id) return;
  const details = await fetchTmdbDetails(mediaType, id);
  await applyTmdbMatch(title, details);
  revalidatePath("/admin/tmdb");
}

export default async function TmdbCoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageStr } = await searchParams;
  const page = Math.max(Number(pageStr) || 1, 1);
  const [cov, { rows, total }] = await Promise.all([
    getTmdbCoverage(),
    listNomatches(q, PAGE_SIZE, (page - 1) * PAGE_SIZE),
  ]);
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const pct = cov.total ? Math.round((cov.ok / cov.total) * 100) : 0;
  const configured = tmdbConfigured();

  return (
    <main className="min-h-screen bg-black text-white px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-semibold tracking-tight">TMDB coverage</h1>
          <Link href="/admin" className="text-sm text-neutral-400 hover:text-white">← Admin</Link>
        </div>

        <div className="grid grid-cols-4 gap-3 my-6">
          <Stat label="Matched" value={cov.ok.toLocaleString()} sub={`${pct}%`} />
          <Stat label="No match" value={cov.nomatch.toLocaleString()} />
          <Stat label="Errors" value={cov.error.toLocaleString()} />
          <Stat label="Total" value={cov.total.toLocaleString()} />
        </div>

        {!configured && (
          <p className="mb-4 text-sm text-amber-400">
            TMDB credentials aren’t set on the server, so saving a match will fail. Add
            <code className="mx-1 rounded bg-neutral-800 px-1">TMDB_READ_TOKEN</code> to the environment.
          </p>
        )}

        <form action="/admin/tmdb" className="mb-5">
          <input
            name="q" defaultValue={q ?? ""} placeholder="Search unmatched titles…"
            className="w-full max-w-md rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none focus:border-neutral-400"
          />
        </form>

        <p className="text-sm text-neutral-500 mb-3">
          {total.toLocaleString()} unmatched · page {page} of {pages}
        </p>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.title} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.title}</p>
                  <a
                    href={`https://www.themoviedb.org/search?query=${encodeURIComponent(r.title)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-sky-400 hover:underline"
                  >
                    search on TMDB ↗
                  </a>
                </div>
                <form action={fixMatch} className="flex items-center gap-2">
                  <input type="hidden" name="title" value={r.title} />
                  <select name="media_type" defaultValue="movie"
                    className="rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm">
                    <option value="movie">Movie</option>
                    <option value="tv">TV</option>
                  </select>
                  <input
                    name="tmdb_id" inputMode="numeric" placeholder="TMDB id"
                    className="w-24 rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm"
                  />
                  <button className="rounded-md bg-white text-black text-sm font-medium px-3 py-1 hover:bg-neutral-200">
                    Save
                  </button>
                </form>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-neutral-400">Nothing unmatched here. 🎉</p>}
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8 text-sm">
            {page > 1
              ? <Link href={pageHref(q, page - 1)} className="rounded-md border border-neutral-700 px-3 py-1 hover:border-neutral-400">← Prev</Link>
              : <span className="text-neutral-700">← Prev</span>}
            <span className="text-neutral-500">{page} / {pages}</span>
            {page < pages
              ? <Link href={pageHref(q, page + 1)} className="rounded-md border border-neutral-700 px-3 py-1 hover:border-neutral-400">Next →</Link>
              : <span className="text-neutral-700">Next →</span>}
          </div>
        )}
      </div>
    </main>
  );
}

function pageHref(q: string | undefined, page: number) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  p.set("page", String(page));
  return `/admin/tmdb?${p.toString()}`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}
