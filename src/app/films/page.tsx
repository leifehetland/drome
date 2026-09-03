import Link from "next/link";
import {
  getFilms,
  countFilms,
  getCategories,
  getFormats,
  getRatings,
  getGenres,
  getDecades,
  getFilmsByCategory,
  type FilmFilters,
  type FilmSort,
} from "@/db/queries";
import { FilmCardGrid, FilmCardRow, FilmCarousel } from "@/components/FilmCard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;
const LANDING_ROWS = 8;

type SP = {
  q?: string; category?: string; format?: string; rating?: string;
  genre?: string; decade?: string; director?: string; sort?: string;
  view?: string; page?: string;
};

function filtersFrom(sp: SP): FilmFilters {
  return {
    q: sp.q, category: sp.category, format: sp.format, rating: sp.rating,
    genre: sp.genre, decade: sp.decade, director: sp.director,
    sort: (["title", "year", "rating"].includes(sp.sort ?? "") ? sp.sort : "title") as FilmSort,
  };
}

function hasAnyFilter(sp: SP) {
  return Boolean(sp.q || sp.category || sp.format || sp.rating || sp.genre || sp.decade || sp.director);
}

function qs(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `/films?${s}` : "/films";
}

export default async function FilmsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = sp.view === "list" ? "list" : "grid";
  const page = Math.max(Number(sp.page) || 1, 1);
  const filters = filtersFrom(sp);
  const showResults = hasAnyFilter(sp) || Boolean(sp.sort);

  const [categories, formats, ratings, genres, decades] = await Promise.all([
    getCategories(), getFormats(), getRatings(), getGenres(), getDecades(),
  ]);

  return (
    <main className="min-h-screen bg-black text-white px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Catalog</h1>
          <Link href="/" className="text-sm text-neutral-400 hover:text-white">← Home</Link>
        </div>

        <form action="/films" className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
          <input type="hidden" name="view" value={view} />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search title, cast, plot…"
            className="col-span-2 rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none focus:border-neutral-400" />
          <input name="director" defaultValue={sp.director ?? ""} placeholder="Director…"
            className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none focus:border-neutral-400" />
          <Select name="sort" value={sp.sort} placeholder="Sort: Title A–Z"
            options={[["title", "Title A–Z"], ["year", "Year ↓"], ["rating", "Rating ↓"]]} />
          <Select name="genre" value={sp.genre} placeholder="Genre"
            options={genres.map((g) => [g, g])} />
          <Select name="decade" value={sp.decade} placeholder="Decade"
            options={decades.map((d) => [String(d), `${d}s`])} />
          <Select name="category" value={sp.category} placeholder="Section"
            options={categories.map((c) => [c.code, `${c.label} (${c.count})`])} />
          <Select name="format" value={sp.format} placeholder="Format"
            options={formats.map((f) => [f, f])} />
          <Select name="rating" value={sp.rating} placeholder="Rating"
            options={ratings.map((r) => [r, r])} />
          <div className="col-span-2 sm:col-span-4 flex gap-2">
            <button className="rounded-md bg-white text-black font-medium px-4 py-2 hover:bg-neutral-200">Apply</button>
            <Link href="/films" className="rounded-md border border-neutral-700 px-4 py-2 text-sm hover:border-neutral-400">Clear</Link>
          </div>
        </form>

        {showResults ? (
          <Results filters={filters} view={view} page={page} sp={sp} />
        ) : (
          <>
            <div className="flex justify-end mb-4"><ViewToggle sp={sp} view={view} /></div>
            {await Promise.all(
              categories.slice(0, LANDING_ROWS).map(async (c) => (
                <FilmCarousel key={c.code} title={c.label} films={await getFilmsByCategory(c.code, 20)} />
              ))
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Select({
  name, value, placeholder, options,
}: { name: string; value?: string; placeholder: string; options: [string, string][] }) {
  return (
    <select name={name} defaultValue={value ?? ""}
      className="rounded-md bg-neutral-900 border border-neutral-700 px-2 py-2 text-sm">
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
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">{total.toLocaleString()} titles · page {page} of {pages}</p>
        <ViewToggle sp={sp} view={view} />
      </div>

      {films.length === 0 ? (
        <p className="text-neutral-400">No matches.</p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {films.map((f) => <FilmCardGrid key={f.title} film={f} />)}
        </div>
      ) : (
        <div className="space-y-2">{films.map((f) => <FilmCardRow key={f.title} film={f} />)}</div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <PageLink sp={sp} page={page - 1} disabled={page <= 1}>← Prev</PageLink>
          <span className="text-sm text-neutral-500">{page} / {pages}</span>
          <PageLink sp={sp} page={page + 1} disabled={page >= pages}>Next →</PageLink>
        </div>
      )}
    </>
  );
}

function base(sp: SP) {
  return {
    q: sp.q, category: sp.category, format: sp.format, rating: sp.rating,
    genre: sp.genre, decade: sp.decade, director: sp.director, sort: sp.sort,
  };
}

function ViewToggle({ sp, view }: { sp: SP; view: "grid" | "list" }) {
  const b = { ...base(sp), page: sp.page };
  return (
    <div className="inline-flex rounded-md border border-neutral-700 overflow-hidden text-sm">
      <Link href={qs({ ...b, view: "grid" })} className={`px-3 py-1 ${view === "grid" ? "bg-white text-black" : "text-neutral-300"}`}>Grid</Link>
      <Link href={qs({ ...b, view: "list" })} className={`px-3 py-1 ${view === "list" ? "bg-white text-black" : "text-neutral-300"}`}>List</Link>
    </div>
  );
}

function PageLink({ sp, page, disabled, children }: { sp: SP; page: number; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="text-sm text-neutral-700">{children}</span>;
  return (
    <Link href={qs({ ...base(sp), view: sp.view, page })}
      className="text-sm rounded-md border border-neutral-700 px-3 py-1 hover:border-neutral-400">
      {children}
    </Link>
  );
}
