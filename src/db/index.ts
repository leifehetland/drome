import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

// prepare:false keeps it compatible with transaction-pooled hosts (Supabase/Neon poolers).
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
