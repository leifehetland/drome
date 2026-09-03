import {
  pgTable,
  text,
  doublePrecision,
  bigint,
  bigserial,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Legacy tables migrated from the vmtvid (Clarion) system.
 * Only the columns the app currently uses are mapped; the physical tables
 * have many more columns (see vmtvid_export.sql).
 */
export const inventor = pgTable("inventor", {
  itemNo: text("item_no").primaryKey(),
  itemTitle: text("item_title"),
  itemType: text("item_type"),
  movieClass: text("movie_class"),
  movieRate: text("movie_rate"),
  movieFormat: text("movie_format"),
  rentSale: text("rent_sale"),
  quantity: doublePrecision("quantity"),
  location: text("location"),
  salePrice: doublePrecision("sale_price"),
  studio: text("studio"),
  barcode: text("barcode"),
  inactive: text("inactive"),
});

export const customer = pgTable("customer", {
  custId: text("cust_id").primaryKey(),
  lastName: text("last_name"),
  firstName: text("first_name"),
  email1: text("email_1"),
  email2: text("email_2"),
  homePhone: text("home_phone"),
  cellPhone: text("cell_phone"),
  city: text("city"),
  state: text("state"),
  status: text("status"),
  expDate: bigint("exp_date", { mode: "number" }),
  memberDate: bigint("member_date", { mode: "number" }),
});

/**
 * Application auth table (new). Kept separate from the legacy customer table:
 * members are linked back to a customer row via customer_id.
 */
export const appUsers = pgTable("app_users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"), // 'admin' | 'staff' | 'member'
  customerId: text("customer_id"), // -> customer.cust_id (no hard FK; legacy data quality)
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppUser = typeof appUsers.$inferSelect;
