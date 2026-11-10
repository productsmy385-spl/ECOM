# API documentation

REST endpoints that return JSON. Business rules live in `@ecom/services`, and route handlers stay thin.

## Admin API: `{ADMIN_URL}/admin/api/*`

The shared wrapper is `apps/admin/lib/api.ts` (`apiRoute`). Every request goes through these steps:
1. **Same-origin check** on POST, PATCH, PUT and DELETE. A foreign `Origin` gets 403. Requests with no `Origin` header (native apps, server-to-server) are allowed.
2. **Staff session** required. Without one the response is 401.
3. **Permission checks inside the service.** These are the authoritative checks.
4. **Error mapping**:

| Status | Meaning | Body |
|---|---|---|
| 400 | Malformed JSON | `{ error }` |
| 401 | Not signed in, or session ended | `{ error }` |
| 403 | Missing permission, escalation attempt, or cross-origin | `{ error }` |
| 404 | Not found **or not yours to see** (IDOR), malformed id | `{ error }` |
| 409 | Conflict: duplicate, in use, or last Super Admin | `{ error }` |
| 422 | Validation failed | `{ error, fieldErrors: { field: [msg] } }` |
| 500 | Unexpected (logged server-side) | `{ error }` (generic) |

Lists return `{ items, page, pageSize, total, totalPages }`. Query parameters: `page` (default 1) and `pageSize` (default 20, maximum 100).

### Staff
| Method & path | Permission | Notes |
|---|---|---|
| `GET /staff?q=&role=&status=&page=` | `staff.view` | Lists staff only. Customers are never included. |
| `POST /staff` | `staff.manage` | Body `{ name, email, phone?, designation?, employeeCode?, roleIds[] }`. Returns 201 `{ staff, invite: { sent, error? } }`. No password is set; the person receives a set-password link. |
| `GET /staff/:id` | `staff.view` | Returns 404 for customer ids |
| `PATCH /staff/:id` | `staff.manage` | Body as POST, without `email`. Role changes are escalation-checked. Your own roles are locked. |
| `POST /staff/:id/status` | `staff.manage` | Body `{ active }`. Deactivating revokes all sessions. You can't change your own status or that of someone more powerful. |
| `POST /staff/:id/invite` | `staff.manage` | Resends the invitation or a reset link (24 h, single use) |

### Roles and permissions
| Method & path | Permission | Notes |
|---|---|---|
| `GET /roles` | any of `staff.view`, `staff.manage`, `roles.manage`, `permissions.manage` | Includes `permissions[]` and `userCount` |
| `POST /roles` | `roles.manage` | Body `{ name, description? }`. The key is generated. Names are unique (case-insensitive). |
| `PATCH /roles/:id` | `roles.manage` | Super Admin role is immutable |
| `DELETE /roles/:id` | `roles.manage` | 409 if the role is a system role or is assigned to anyone |
| `PUT /roles/:id/permissions` | `permissions.manage` | Body `{ permissions: string[] }` (the full set). You can only grant what you hold. |
| `GET /permissions` | any of `roles.manage`, `permissions.manage`, `staff.manage` | The catalogue, grouped by module |

### Audit logs
| Method & path | Permission | Notes |
|---|---|---|
| `GET /audit-logs?action=&entityType=&actorId=&from=&to=&page=` | `audit_logs.view` | Newest first, with actor details |
| `GET /audit-logs?facets=1` | `audit_logs.view` | Distinct actions and entity types, for filters |

### Catalog (Phase 3)
Money is in **paise** everywhere in the API. Prices are GST-inclusive.

| Method & path | Permission | Notes |
|---|---|---|
| `GET /categories` · `POST` · `PATCH /:id` · `DELETE /:id` | view: `products.view`/`categories.manage`; write: `categories.manage` | Two levels. Parent loops are rejected. Delete only when empty (soft delete; frees the slug). |
| `GET /brands` · `POST` · `PATCH /:id` · `DELETE /:id` | same | Delete only when no products |
| `GET /products?q=&status=&categoryId=&page=` | `products.view` | `q` matches name or SKU |
| `GET /products/options` | catalog view | Category and brand choices |
| `POST /products` | `products.create` | Always created as a **draft**. Body: `name, categoryId, brandId?, taxRateBps (0/500/1200/1800/2800), variants[] (sku, name, price, compareAtPrice?, color?, colorHex?, size?, material?, initialStock?), attributes[], images[] (ImageKit URLs only)`. `initialStock > 0` also needs `inventory.manage`. |
| `GET /products/:id` · `PUT /products/:id` | `products.view` · `products.update` | PUT replaces specs and images. Variants are matched by `id`; omitted variants are soft-deleted. SKUs are never reusable. |
| `POST /products/:id/status` | `products.publish` | `{ status: draft \| published \| archived }`. Publishing needs at least one active priced variant and an active category. |
| `DELETE /products/:id` | `products.delete` | Soft delete. Orders keep their references. |
| `POST /variants/:id/stock` | `inventory.manage` | `{ delta, note }`. Written to the ledger. Can't drop below reserved (409). |
| `GET /uploads/imagekit-auth` | product or category write | `{ token, expire, signature, publicKey, urlEndpoint }`, or 503 if ImageKit isn't configured |

### Auth (Better Auth)
`/admin/api/auth/*`: sign-in, sign-out, `request-password-reset`, `reset-password`, `change-password`, get-session. See AUTHENTICATION.md.

### Health
`GET /admin/api/health`. Returns 200, or 503 when the database is unreachable.

## Storefront API: `{WEB_URL}/api/*` (public)
Rate limits are per IP and in memory (see SECURITY.md).

| Method & path | Limit | Notes |
|---|---|---|
| `GET /api/search/suggest?q=` | 60/min | `{ products[≤6], categories[≤4], brands[≤4] }`. Queries shorter than 2 characters return nothing. |
| `GET /api/products/:slug` | 120/min | Published products only. Availability is coarse (`in_stock \| low_stock \| out_of_stock`); exact stock counts are never exposed. |
| `POST /api/newsletter` | 5/min | `{ email }`. Same-origin only. Idempotent, and returns the same response for new and existing addresses. |
| `/api/auth/*` | per-route | Customer auth |
| `GET /api/health` | none | |

Storefront pages read through `@ecom/services` (`searchCatalog`, `getProductBySlug`, `getHomeData`) and only ever show published products in active categories. Cart and order endpoints arrive in Phases 5–6.
