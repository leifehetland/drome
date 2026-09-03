// Seed auth users. Usage:
//   DATABASE_URL=... [ADMIN_PASSWORD=... MEMBER_PASSWORD=...] node scripts/seed.mjs
import postgres from "postgres";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

const users = [
  {
    email: "admin@videodrome.local",
    password: process.env.ADMIN_PASSWORD || "changeme-admin",
    role: "admin",
    name: "Admin",
    customerId: null,
  },
  {
    email: "member@videodrome.local",
    password: process.env.MEMBER_PASSWORD || "changeme-member",
    role: "member",
    name: "Demo Member",
    customerId: null,
  },
];

try {
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await sql`
      INSERT INTO app_users (email, password_hash, role, name, customer_id)
      VALUES (${u.email.toLowerCase()}, ${hash}, ${u.role}, ${u.name}, ${u.customerId})
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            name = EXCLUDED.name
    `;
    console.log(`seeded ${u.role}: ${u.email}`);
  }
  console.log("\nDone. Change these passwords for anything non-local.");
} catch (err) {
  console.error("Seed failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
