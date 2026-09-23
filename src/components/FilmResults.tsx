"use client";
import { useState } from "react";
import Link from "next/link";
import type { FilmRow } from "@/db/queries";
import { FilmCardGrid, FilmCardRow } from "@/components/FilmCard";

type View = "grid" | "list";

function qs(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `/films?${s}` : "/films";
}

/**
 * Results list with an instant, client-side Grid/List toggle. The choice is mirrored
 * into ?view= (without a server round trip) so reloads, pagination and the filter
 * form keep it.
 */
export default function FilmResults({
  films, total, page, pages, initialView, base,
}: {
  films: FilmRow[];
  total: number;
  page: number;
  pages: number;
  initialView: View;
  base: Record<string, string | undefined>;
}) {
  const [view, setView] = useState<View>(initialView);

  function choose(v: View) {
    setView(v);
    const url = new URL(window.location.href);
    url.searchParams.set("view", v);
    window.history.replaceState(window.history.state, "", url);
    // Keep the sidebar form's hidden field in sync so "Apply" preserves the view.
    document.querySelectorAll<HTMLInputElement>('form[action="/films"] input[name="view"]')
      .forEach((el) => { el.value = v; });
  }

  const btn = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => choose(v)}
      aria-pressed={view === v}
      className={`px-3 py-1 ${view === v ? "bg-white text-black" : "text-neutral-300 hover:text-white"}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">{total.toLocaleString()} titles · page {page} of {pages}</p>
        <div className="inline-flex rounded-md border border-neutral-700 overflow-hidden text-sm">
          {btn("grid", "Grid")}
          {btn("list", "List")}
        </div>
      </div>

      {films.length === 0 ? (
        <p className="text-neutral-400">No matches. Try clearing a filter.</p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {films.map((f, i) => <FilmCardGrid key={`${f.tmdb_id ?? f.title}-${i}`} film={f} />)}
        </div>
      ) : (
        <div className="space-y-2">
          {films.map((f, i) => <FilmCardRow key={`${f.tmdb_id ?? f.title}-${i}`} film={f} />)}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <PageLink href={qs({ ...base, view, page: page - 1 })} disabled={page <= 1}>← Prev</PageLink>
          <span className="text-sm text-neutral-500">{page} / {pages}</span>
          <PageLink href={qs({ ...base, view, page: page + 1 })} disabled={page >= pages}>Next →</PageLink>
        </div>
      )}
    </>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="text-sm text-neutral-700">{children}</span>;
  return (
    <Link href={href} className="text-sm rounded-md border border-neutral-700 px-3 py-1 hover:border-neutral-400">
      {children}
    </Link>
  );
}
