import { redirect } from "next/navigation";
import { signIn, auth } from "@/auth";
import { AuthError } from "next-auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/account");
  const { error, callbackUrl } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const redirectTo = String(formData.get("callbackUrl") || "/account");
    try {
      await signIn("credentials", { email, password, redirectTo });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/login?error=1${callbackUrl ? `&callbackUrl=${callbackUrl}` : ""}`);
      }
      throw err; // redirect() throws internally — let it bubble
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <form action={login} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Videodrome — Sign in</h1>
        {error && (
          <p className="text-sm text-red-400">Invalid email or password.</p>
        )}
        <input type="hidden" name="callbackUrl" defaultValue={callbackUrl ?? ""} />
        <div className="space-y-2">
          <label className="block text-sm text-neutral-400">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none focus:border-neutral-400"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-neutral-400">Password</label>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none focus:border-neutral-400"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-white text-black font-medium py-2 hover:bg-neutral-200 transition"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
