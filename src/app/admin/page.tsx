import { auth } from "@/auth";
import { searchCustomers } from "@/db/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const { q } = await searchParams;
  const customers = q ? await searchCustomers(q) : [];

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
          <Link href="/account" className="text-sm text-neutral-400 hover:text-white">
            Account
          </Link>
        </div>
        <p className="text-sm text-neutral-500 mb-8">
          Signed in as {session?.user?.email} ({session?.user?.role}).
        </p>

        <h2 className="text-lg font-medium mb-3">Customer lookup</h2>
        <form action="/admin" className="mb-6">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, email, or customer ID…"
            className="w-full max-w-md rounded-md bg-neutral-900 border border-neutral-700 px-4 py-2 outline-none focus:border-neutral-400"
          />
        </form>

        {q && (
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <Th>ID</Th>
                  <Th>Last</Th>
                  <Th>First</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.cust_id} className="border-t border-neutral-800">
                    <Td>{c.cust_id}</Td>
                    <Td>{c.last_name}</Td>
                    <Td>{c.first_name}</Td>
                    <Td>{c.email_1}</Td>
                    <Td>{c.home_phone}</Td>
                    <Td>{c.status}</Td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-neutral-500">
                      No matches.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children ?? "—"}</td>;
}
