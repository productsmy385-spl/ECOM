import { sql } from "drizzle-orm";
import { boolean, index, pgTable, primaryKey, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, id, timestamps } from "./_helpers";
import { users } from "./users";

export const roles = pgTable(
  "roles",
  {
    id: id(),
    key: varchar("key", { length: 64 }).notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    /** System roles are seeded and cannot be deleted or renamed by key. */
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps(),
  },
  // Names are unique case-insensitively so the staff role picker is unambiguous.
  (t) => [uniqueIndex("roles_name_lower_uq").on(sql`lower(${t.name})`)],
);

export const permissions = pgTable("permissions", {
  id: id(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  module: varchar("module", { length: 32 }).notNull(),
  description: text("description").notNull(),
  createdAt: createdAt(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index("user_roles_role_idx").on(t.roleId)],
);
