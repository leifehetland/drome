import { auth, signOut } from "@/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  const user = session?.user;

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
      </div>
    </main>
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
