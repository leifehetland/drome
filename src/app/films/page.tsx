import Link from "next/link";
import { getFilms } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function FilmsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const films = await getFilms({ q, limit: 120 });

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Catalog</h1>
          <Link href="/" className="text-sm text-neutral-400 hover:text-white">
            ← Home
          </Link>
        </div>

        <form className="mb-8" action="/films">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search titles…"
            className="w-full max-w-md rounded-md bg-neutral-900 border border-neutral-700 px-4 py-2 outline-none focus:border-neutral-400"
          />
        </form>

        <p className="text-sm text-neutral-500 mb-4">
          {films.length} titles{q ? ` matching “${q}”` : ""} — live from Postgres
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {films.map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
            >
              <h2 className="font-medium leading-tight">{f.title}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-400">
                {f.rate && <span className="rounded bg-neutral-800 px-2 py-0.5">{f.rate}</span>}
                {f.formats &&
                  f.formats.split(",").map((fmt) => (
                    <span key={fmt} className="rounded bg-neutral-800 px-2 py-0.5">
                      {fmt}
                    </span>
                  ))}
                <span className="rounded bg-neutral-800 px-2 py-0.5">
                  {Math.round(f.total_copies)} cop{Math.round(f.total_copies) === 1 ? "y" : "ies"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
