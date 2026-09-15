import { auth, signOut } from "@/auth";
import Link from "next/link";
import { getSaves, type SavedFilm } from "@/db/queries";
import { removeSaveById } from "@/app/saves-actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  const user = session?.user;
  const uid = user?.id ? Number(user.id) : null;
  const [watchlist, holds] = uid
    ? await Promise.all([getSaves(uid, "watchlist"), getSaves(uid, "hold")])
    : [[], []];

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">My Account</h1>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="text-sm text-neutral-400 hover:text-white">Sign out</button>
          </form>
        </div>

        <dl className="space-y-3 text-sm">
          <Row label="Name" value={user?.name} />
          <Row label="Email" value={user?.email} />
          <Row label="Role" value={user?.role} />
          <Row label="Linked customer ID" value={user?.customerId ?? "—"} />
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/account/rentals"
            className="inline-block rounded-md bg-white text-black font-medium px-4 py-2 hover:bg-neutral-200"
          >
            My rentals →
          </Link>
          {(user?.role === "admin" || user?.role === "staff") && (
            <Link
              href="/admin"
              className="inline-block rounded-md border border-neutral-700 px-4 py-2 hover:border-neutral-400"
            >
              Open admin →
            </Link>
          )}
        </div>

        <SaveList title="Watchlist" items={watchlist} empty="Nothing saved yet — add films from the catalog." />
        <SaveList title="Holds" items={holds} empty="No holds requested." />
      </div>
    </main>
  );
}

function filmHref(s: SavedFilm) {
  return s.tmdb_id
    ? `/films/detail?id=${s.tmdb_id}&mt=${s.media_type ?? "movie"}`
    : `/films/detail?t=${encodeURIComponent(s.title ?? "")}`;
}

function SaveList({ title, items, empty }: { title: string; items: SavedFilm[]; empty: string }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium mb-3">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
              <Link href={filmHref(s)} className="text-sm hover:text-white truncate">{s.title ?? "Untitled"}</Link>
              <form action={removeSaveById}>
                <input type="hidden" name="id" value={s.id} />
                <button className="text-xs text-neutral-500 hover:text-red-400 shrink-0">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between border-b border-neutral-800 py-2">
      <dt className="text-neutral-400">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
}
