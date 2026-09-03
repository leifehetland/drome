import Link from "next/link";
import { auth } from "@/auth";
import { getCustomerRentals } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function RentalsPage() {
  const session = await auth();
  const customerId = session?.user?.customerId ?? null;
  const rentals = customerId ? await getCustomerRentals(customerId) : [];

  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">My Rentals</h1>
          <Link href="/account" className="text-sm text-neutral-400 hover:text-white">
            ← Account
          </Link>
        </div>

        {!customerId ? (
          <p className="text-neutral-400">
            Your account isn’t linked to a customer record yet, so there’s no rental
            history to show.
          </p>
        ) : rentals.length === 0 ? (
          <p className="text-neutral-400">
            No rental history found (the history table may not be loaded on this
            deployment).
          </p>
        ) : (
          <>
            <p className="text-sm text-neutral-500 mb-4">{rentals.length} most recent rentals</p>
            <div className="overflow-x-auto rounded-lg border border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-neutral-400">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Title</th>
                    <th className="text-left font-medium px-3 py-2">Type</th>
                    <th className="text-left font-medium px-3 py-2">Rented</th>
                    <th className="text-left font-medium px-3 py-2">Returned</th>
                    <th className="text-right font-medium px-3 py-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {rentals.map((r, idx) => (
                    <tr key={`${r.rentid}-${idx}`} className="border-t border-neutral-800">
                      <td className="px-3 py-2">{r.title ?? r.rentid}</td>
                      <td className="px-3 py-2 text-neutral-400">{r.item_type ?? "—"}</td>
                      <td className="px-3 py-2">{r.rented ?? "—"}</td>
                      <td className="px-3 py-2 text-neutral-400">{r.returned ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {r.price != null ? `$${Number(r.price).toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
