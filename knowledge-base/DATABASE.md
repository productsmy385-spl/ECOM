# Database

PostgreSQL 17 (local Docker) and Railway Postgres (production), accessed through Drizzle ORM 0.45 over `pg` with a connection pool.
- Schema: `packages/db/src/schema/*.ts`
- Migrations: `packages/db/migrations/`
- Relationship diagram: [ERD.md](ERD.md)

## Conventions `[fact]`
- **Keys**: every table uses a `uuid` primary key (`gen_random_uuid()`), except join tables (composite PK) and `system_settings` (text key).
- **Timestamps**: always `timestamptz`, with `created_at` and `updated_at` on mutable tables.
- **Soft delete** (`deleted_at`): `users`, `addresses`, `categories`, `brands`, `products`, `product_variants`, `suppliers`, `customer_designs`. Orders and payments are never deleted. FKs from them use `restrict`.
- **Money**: integer paise. Tax rates are basis points (`1800` = 18%).
- **Snapshots**: `order_items` copies name, SKU, price and customization; `orders` copies the address. Invoices never change when the catalog changes.
- **Case-insensitive uniqueness**: `lower(email)` on users and newsletter subscribers, `upper(code)` on coupons.

## Integrity enforced by the database itself `[fact]`
| Rule | Constraint |
|---|---|
| No overselling | `inventory` CHECK `reserved <= on_hand`, `on_hand >= 0`, `reserved >= 0`. Verified: reserving 3 of 2 fails. |
| One default address per customer | partial unique index `addresses_one_default_uq` |
| One cart per user / guest token | partial unique indexes on `carts` |
| Cart and order owner present | CHECK user or guest on `carts` and `orders` |
| Duplicate checkout submissions | `orders.idempotency_key` UNIQUE |
| Duplicate webhook events | `payment_events (provider, event_id)` UNIQUE |
| Refund cannot exceed payment | CHECK `refunded_amount <= amount` |
| Valid ratings, one review per product per user | CHECK 1–5, UNIQUE `(user_id, product_id)` |
| MRP ≥ selling price | CHECK on `product_variants` |

## Search
`products.search_vector` is a generated `tsvector` (name A, short description B, description C) with a GIN index. Fuzzy name matching uses `pg_trgm` (`products_name_trgm_idx`). The extension is created in `0000_extensions.sql`.

## Table groups (52 tables)
- **Identity**: `users`, `sessions`, `accounts`, `verifications`, `customer_profiles`, `staff_profiles`, `addresses`
- **RBAC**: `roles`, `permissions`, `role_permissions`, `user_roles`
- **Catalog**: `categories` (self-referencing tree), `brands`, `products`, `product_images`, `product_variants`, `product_attributes`, `customization_options`, `reviews`
- **Inventory**: `inventory`, `inventory_movements` (append-only ledger), `suppliers`, `purchases`, `purchase_items`
- **Designs**: `customer_designs`, `design_versions` (immutable, full config in jsonb), `design_approvals`, `design_notes`
- **Commerce**: `carts`, `cart_items`, `wishlists`, `wishlist_items`, `coupons`, `coupon_redemptions`, `orders`, `order_items`, `order_status_history`, `order_notes`, `payments`, `payment_events`, `refunds`
- **Operations**: `deliveries`, `delivery_assignments`, `delivery_status_history`, `notifications`, `push_tokens`, `support_tickets`, `support_ticket_messages`, `banners`, `newsletter_subscribers`
- **System**: `audit_logs` (append-only), `system_settings`

Every product has at least one variant. Price, SKU, barcode and stock live on the variant.

## Workflow
| Command | Purpose |
|---|---|
| `pnpm db:up` / `db:down` | Start or stop local Postgres (5433) and Redis (6380) |
| `pnpm db:generate` | Generate a SQL migration from schema changes. Review the SQL before committing. |
| `pnpm db:migrate` | Apply pending migrations. Takes an advisory lock and runs in a transaction. |
| `pnpm db:check` | Check migration consistency |
| `pnpm db:seed` | Idempotent seed: permissions, 9 roles, 8 categories, settings, first Super Admin |
| `pnpm db:studio` | Drizzle Studio |

Rules:
- Never use `drizzle-kit push` against production.
- Never edit a migration that has been applied.
- Migrations must be additive. To remove something, deprecate it first and drop it in a later release.

## Seed behaviour `[fact]`
- Permission keys are upserted from `@ecom/rbac`.
- System roles get their default permissions **only when first created**. Later runs never overwrite edits made in the matrix UI. The exception is `super_admin`, which always receives every permission.
- The seed contains no demo products, orders or customers.

## Backups and recovery
- **Railway**: enable scheduled backups on the Postgres service (Database → Backups). Before any migration that changes data, take a manual backup.
- **Manual dump**: `pg_dump "$DATABASE_URL" -Fc -f backup.dump`. Restore with `pg_restore -d "$TARGET_URL" --no-owner backup.dump`.
- Test a restore into a scratch database at least once before launch. Not yet done; tracked in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
