import Link from "next/link";
import type { FilmRow } from "@/db/queries";
import { posterUrl } from "@/db/queries";

function href(title: string) {
  return `/films/detail?t=${encodeURIComponent(title)}`;
}

function Poster({ film, className }: { film: FilmRow; className?: string }) {
  const url = posterUrl(film.poster_path);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={film.title} className={className} loading="lazy" />;
  }
  return (
    <div
      className={`${className} flex items-center justify-center bg-neutral-900 border border-neutral-800 p-3 text-center`}
    >
      <span className="text-xs text-neutral-400 line-clamp-4">{film.title}</span>
    </div>
  );
}

/** Grid (poster) card. */
export function FilmCardGrid({ film }: { film: FilmRow }) {
  return (
    <Link href={href(film.title)} className="group block">
      <Poster
        film={film}
        className="w-full aspect-[2/3] object-cover rounded-lg group-hover:opacity-80 transition"
      />
      <div className="mt-2">
        <p className="text-sm font-medium leading-tight line-clamp-2">{film.title}</p>
        <p className="text-xs text-neutral-500">
          {[film.release_year, film.director].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
    </Link>
  );
}

/** Compact list row. */
export function FilmCardRow({ film }: { film: FilmRow }) {
  return (
    <Link
      href={href(film.title)}
      className="flex gap-3 items-center rounded-lg border border-neutral-800 bg-neutral-950 p-2 hover:border-neutral-600 transition"
    >
      <Poster film={film} className="w-10 h-15 object-cover rounded shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{film.title}</p>
        <p className="text-xs text-neutral-500 truncate">
          {[film.release_year, film.director, film.genres].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <div className="flex flex-wrap gap-1 justify-end shrink-0">
        {film.rate && <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs">{film.rate}</span>}
        {film.formats?.split(",").map((f) => (
          <span key={f} className="rounded bg-neutral-800 px-2 py-0.5 text-xs">{f}</span>
        ))}
      </div>
    </Link>
  );
}

/** Horizontal carousel of poster cards. */
export function FilmCarousel({ title, films }: { title: string; films: FilmRow[] }) {
  if (films.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {films.map((f) => (
          <div key={f.title} className="w-32 shrink-0 snap-start">
            <FilmCardGrid film={f} />
          </div>
        ))}
      </div>
    </section>
  );
}
