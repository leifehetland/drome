import Link from "next/link";
import { notFound } from "next/navigation";
import { getFilmDetail, posterUrl } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function FilmDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  if (!t) notFound();
  const film = await getFilmDetail(t);
  if (!film) notFound();

  const poster = posterUrl(film.poster_path, "w500");

  return (
    <main className="min-h-screen bg-black text-white px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/films" className="text-sm text-neutral-400 hover:text-white">← Catalog</Link>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6">
          <div>
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt={film.title} className="w-full rounded-lg" />
            ) : (
              <div className="w-full aspect-[2/3] rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center p-4 text-center text-neutral-400">
                {film.title}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{film.title}</h1>
            <p className="text-neutral-400 mt-1">
              {[film.release_year, film.director, film.genres].filter(Boolean).join(" · ") || "—"}
            </p>

            <div className="flex flex-wrap gap-2 mt-4 text-xs">
              {film.rate && <Badge>{film.rate}</Badge>}
              {film.formats?.split(",").map((f) => <Badge key={f}>{f}</Badge>)}
              {film.vote_average ? <Badge>★ {Number(film.vote_average).toFixed(1)}</Badge> : null}
            </div>

            {film.overview && (
              <p className="mt-5 text-sm leading-relaxed text-neutral-200">{film.overview}</p>
            )}
            {film.top_cast && (
              <p className="mt-4 text-sm text-neutral-400">
                <span className="text-neutral-500">Cast: </span>{film.top_cast}
              </p>
            )}

            <div className="mt-6 border-t border-neutral-800 pt-4 text-sm space-y-1">
              <Row label="Copies in catalog" value={String(Math.round(film.total_copies))} />
              <Row label="Formats" value={film.formats ?? "—"} />
              <Row label="Type" value={film.item_types ?? "—"} />
              <Row label="Shelf location" value={film.locations ?? "—"} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-neutral-800 px-2 py-0.5">{children}</span>;
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
