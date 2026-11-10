import { type AnyPgColumn, index, integer, jsonb, pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, deletedAt, id, timestamps, ts } from "./_helpers";
import { approvalDecision, designAuthorType, designStatus } from "./enums";
import { products, productVariants } from "./catalog";
import { users } from "./users";

/**
 * A customer's customized design for a product. The full, reproducible
 * configuration lives in design_versions.config (never only a preview image).
 * Guests can design before signing in via `guestToken`; the design is claimed
 * to `customerId` on login.
 */
export const customerDesigns = pgTable(
  "customer_designs",
  {
    id: id(),
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "cascade" }),
    guestToken: varchar("guest_token", { length: 64 }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    name: text("name").notNull().default("My design"),
    status: designStatus("status").notNull().default("draft"),
    currentVersionId: uuid("current_version_id").references(
      (): AnyPgColumn => designVersions.id,
      { onDelete: "set null" },
    ),
    /** Designer assigned by a manager; designers may only access their assigned designs. */
    assignedDesignerId: uuid("assigned_designer_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedAt: ts("assigned_at"),
    submittedAt: ts("submitted_at"),
    approvedAt: ts("approved_at"),
    deletedAt: deletedAt(),
    ...timestamps(),
  },
  (t) => [
    index("customer_designs_customer_idx").on(t.customerId),
    index("customer_designs_guest_idx").on(t.guestToken),
    index("customer_designs_designer_status_idx").on(t.assignedDesignerId, t.status),
    index("customer_designs_status_idx").on(t.status),
  ],
);

/**
 * Immutable snapshot of a design. `config` stores:
 *   { options: { [optionKey]: value }, canvas?: { width, height, layers: [...] } }
 * Layers include type (text|image|shape), position, rotation, font, colour, ImageKit URL.
 */
export const designVersions = pgTable(
  "design_versions",
  {
    id: id(),
    designId: uuid("design_id")
      .notNull()
      .references(() => customerDesigns.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    config: jsonb("config").notNull(),
    previewUrl: text("preview_url"),
    authorType: designAuthorType("author_type").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("design_versions_design_version_uq").on(t.designId, t.version)],
);

export const designApprovals = pgTable(
  "design_approvals",
  {
    id: id(),
    designId: uuid("design_id")
      .notNull()
      .references(() => customerDesigns.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => designVersions.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorType: designAuthorType("actor_type").notNull(),
    decision: approvalDecision("decision").notNull(),
    comment: text("comment"),
    createdAt: createdAt(),
  },
  (t) => [index("design_approvals_design_idx").on(t.designId, t.createdAt)],
);

/** Internal designer/manager notes on a design (never shown to customers). */
export const designNotes = pgTable(
  "design_notes",
  {
    id: id(),
    designId: uuid("design_id")
      .notNull()
      .references(() => customerDesigns.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    ...timestamps(),
  },
  (t) => [index("design_notes_design_idx").on(t.designId)],
);
