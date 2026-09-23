import Link from "next/link";
import {
  getFilms,
  countFilms,
  getCategories,
  getFormats,
  getRatings,
  getGenres,
  getDecades,
  getCountries,
  getFilmsByCategory,
  type FilmFilters,
  type FilmSort,
} from "@/db/queries";
import { FilmCarousel } from "@/components/FilmCard";
import FilmResults from "@/components/FilmResults";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;
const LANDING_ROWS = 8;

// Curated swaps for the landing carousels (which otherwise show the biggest sections).
// Key = section to drop; value = replacements to try in order, matched on the cleaned
// section label. If none qualify, the next-largest section fills the slot.
const LANDING_SWAPS: Record<string, string[]> = {
  "woody allen": ["billy wilder", "orson welles"],
};

type Category = Awaited<ReturnType<typeof getCategories>>[number];

function landingSections(categories: Category[]): Category[] {
  const norm = (c: Category) => c.label.trim().toLowerCase();
  const dropped = new Set(Object.keys(LANDING_SWAPS));
  const picked: Category[] = [];
  for (const c of categories.slice(0, LANDING_ROWS)) {
    const alts = LANDING_SWAPS[norm(c)];
    if (!alts) { picked.push(c); continue; }
    const alt = alts
      .map((a) => categories.find((x) => norm(x) === a))
      .find((x): x is Category => Boolean(x) && !picked.includes(x!));
    if (alt) picked.push(alt);
  }
  // Backfill any empty slots with the next-largest sections.
  for (const c of categories) {
    if (picked.length >= LANDING_ROWS) break;
    if (!picked.includes(c) && !dropped.has(norm(c))) picked.push(c);
  }
  return picked;
}

type SP = {
  q?: string; category?: string; format?: string; rating?: string;
  genre?: string; decade?: string; director?: string; country?: string; sort?: string;
  view?: string; page?: string;
};

function filtersFrom(sp: SP): FilmFilters {
  return {
    q: sp.q, category: sp.category, format: sp.format, rating: sp.rating,
    genre: sp.genre, decade: sp.decade, director: sp.director, country: sp.country,
    sort: (["title", "year", "rating"].includes(sp.sort ?? "") ? sp.sort : "title") as FilmSort,
  };
}

function hasAnyFilter(sp: SP) {
  return Boolean(sp.q || sp.category || sp.format || sp.rating || sp.genre || sp.decade || sp.director || sp.country);
}

export default async function FilmsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "grid";
  const page = Math.max(Number(sp.page) || 1, 1);
  const filters = filtersFrom(sp);
  const showResults = hasAnyFilter(sp) || Boolean(sp.sort);

  const [categories, formats, ratings, genres, decades, countries] = await Promise.all([
    getCategories(), getFormats(), getRatings(), getGenres(), getDecades(), getCountries(),
  ]);

  return (
    <main className="min-h-screen bg-black text-white px-4 sm:px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Catalog</h1>
          <Link href="/" className="text-sm text-neutral-400 hover:text-white">← Home</Link>
        </div>

        <div className="lg:flex lg:gap-8">
          {/* Filter sidebar (persistent on desktop, collapsible on mobile) */}
          <aside className="lg:w-60 lg:shrink-0 mb-6 lg:mb-0">
            <details open className="group [&_summary]:lg:hidden">
              <summary className="cursor-pointer list-none rounded-md border border-neutral-700 px-4 py-2 mb-3 select-none">
                Filters ▾
              </summary>
              <form action="/films" className="space-y-2 lg:sticky lg:top-6">
                <input type="hidden" name="view" value={view} />
                <input name="q" defaultValue={sp.q ?? ""} placeholder="Search title, cast, plot…"
                  className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none focus:border-neutral-400" />
                <input name="director" defaultValue={sp.director ?? ""} placeholder="Director…"
                  className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none focus:border-neutral-400" />
                <Select name="sort" value={sp.sort} placeholder="Sort: Title A–Z"
                  options={[["title", "Title A–Z"], ["year", "Year ↓"], ["rating", "Rating ↓"]]} />
                <Select name="genre" value={sp.genre} placeholder="Genre" options={genres.map((g) => [g, g])} />
                <Select name="decade" value={sp.decade} placeholder="Decade" options={decades.map((d) => [String(d), `${d}s`])} />
                {countries.length > 0 && (
                  <Select name="country" value={sp.country} placeholder="Country" options={countries.map((c) => [c, c])} />
                )}
                <Select name="category" value={sp.category} placeholder="Section" options={categories.map((c) => [c.code, `${c.label} (${c.count})`])} />
                <Select name="format" value={sp.format} placeholder="Format" options={formats.map((f) => [f, f])} />
                <Select name="rating" value={sp.rating} placeholder="Rating" options={ratings.map((r) => [r, r])} />
                <div className="flex gap-2 pt-1">
                  <button className="flex-1 rounded-md bg-white text-black font-medium px-4 py-2 hover:bg-neutral-200">Apply</button>
                  <Link href="/films" className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-400">Clear</Link>
                </div>
              </form>
            </details>
          </aside>

          {/* Content */}
          <section className="flex-1 min-w-0">
            {showResults ? (
              <Results filters={filters} view={view} page={page} sp={sp} />
            ) : (
              <>
                {await Promise.all(
                  landingSections(categories).map(async (c) => (
                    <FilmCarousel key={c.code} title={c.label} films={await getFilmsByCategory(c.code, 20)} />
                  ))
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Select({
  name, value, placeholder, options,
}: { name: string; value?: string; placeholder: string; options: [string, string][] }) {
  return (
    <select name={name} defaultValue={value ?? ""}
      className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-2 py-2 text-sm">
      <option value="">{placeholder}</option>
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

async function Results({
  filters, view, page, sp,
}: { filters: FilmFilters; view: "grid" | "list"; page: number; sp: SP }) {
  const offset = (page - 1) * PAGE_SIZE;
  const [films, total] = await Promise.all([
    getFilms({ ...filters, limit: PAGE_SIZE, offset }),
    countFilms(filters),
  ]);
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <FilmResults
      films={films}
      total={total}
      page={page}
      pages={pages}
      initialView={view}
      base={base(sp)}
    />
  );
}

function base(sp: SP) {
  return {
    q: sp.q, category: sp.category, format: sp.format, rating: sp.rating,
    genre: sp.genre, decade: sp.decade, director: sp.director, country: sp.country, sort: sp.sort,
  };
}
