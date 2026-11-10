import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { deletedAt, id, timestamps, ts } from "./_helpers";
import { userStatus } from "./enums";

/**
 * Identity table shared by customers and staff (Better Auth "user" model).
 * Whether a user is staff is decided by having rows in user_roles, never by a
 * client-supplied flag. `isStaff` is a denormalised hint for listing only.
 */
export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    phone: varchar("phone", { length: 20 }),
    isStaff: boolean("is_staff").notNull().default(false),
    status: userStatus("status").notNull().default("active"),
    lastLoginAt: ts("last_login_at"),
    deletedAt: deletedAt(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`),
    index("users_is_staff_idx").on(t.isStaff),
  ],
);

/** Better Auth sessions. Token is opaque; cookie is httpOnly. */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Better Auth credential/provider accounts (password hash lives here). */
export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    ...timestamps(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    uniqueIndex("accounts_provider_account_uq").on(t.providerId, t.accountId),
  ],
);

/** Better Auth verification values (email OTP, password reset tokens). */
export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    ...timestamps(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const customerProfiles = pgTable("customer_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dateOfBirth: date("date_of_birth"),
  gender: varchar("gender", { length: 20 }),
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
  ...timestamps(),
});

export const staffProfiles = pgTable("staff_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  employeeCode: varchar("employee_code", { length: 32 }).unique(),
  designation: text("designation"),
  isActive: boolean("is_active").notNull().default(true),
  joinedOn: date("joined_on"),
  ...timestamps(),
});

export const addresses = pgTable(
  "addresses",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 40 }),
    fullName: text("full_name").notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    landmark: text("landmark"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    postalCode: varchar("postal_code", { length: 10 }).notNull(),
    country: varchar("country", { length: 2 }).notNull().default("IN"),
    isDefault: boolean("is_default").notNull().default(false),
    deletedAt: deletedAt(),
    ...timestamps(),
  },
  (t) => [
    index("addresses_user_idx").on(t.userId),
    // At most one default address per customer.
    uniqueIndex("addresses_one_default_uq")
      .on(t.userId)
      .where(sql`${t.isDefault} = true and ${t.deletedAt} is null`),
  ],
);
