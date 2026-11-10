# RBAC: roles, permissions and data isolation

Source of truth for permission **keys**: `packages/rbac/src/permissions.ts`.
Source of truth for **who has what at runtime**: the database (`roles`, `role_permissions`, `user_roles`).

## Model `[fact]`
- **A user is staff if and only if they have at least one row in `user_roles`.** The `users.is_staff` column is a listing hint only. It cannot be set through sign-up, because it is an `input: false` field, and tests cover this.
- **Permissions are loaded per request** from the DB (`loadActor`). Revoking a permission takes effect on the next request.
- **`super_admin` passes every check** in code (`isSuperAdmin`) and also holds every permission row.
- **`*_assigned` permissions are record-scoped.** They grant access only to records where the assignee is the acting user. Checked with `canAccessAssigned(actor, global, assigned, assigneeId)`. When access is denied, respond **404, not 403**, so the existence of the record does not leak (IDOR).

## Permission catalogue (42)
| Module | Permissions |
|---|---|
| Dashboard | `dashboard.view` |
| Products | `products.view` `.create` `.update` `.delete` `.publish`, `categories.manage` |
| Orders | `orders.view` `.view_assigned` `.create` `.update` `.cancel` `.assign` |
| Customers | `customers.view` `.update` |
| Inventory | `inventory.view` `.manage` |
| Designs | `designs.view` `.view_assigned` `.create` `.update` `.assign` `.approve` |
| Deliveries | `deliveries.view` `.view_assigned` `.assign` `.update` `.update_assigned` |
| Payments | `payments.view` `.refund` |
| Support | `support.view` `.manage`, `reviews.moderate` |
| Marketing | `marketing.manage` |
| Reports | `reports.view` `.export` |
| Staff | `staff.view` `.manage`, `roles.manage`, `permissions.manage` |
| Settings | `settings.manage`, `audit_logs.view` |

**Additions beyond the original spec list `[proposed]`:** the `*_assigned` variants, `designs.update`/`.assign`, `categories.manage`, `support.*`, `reviews.moderate`, `marketing.manage` and `staff.view`. These were needed to express data isolation and modules the spec describes but didn't name permissions for.

## Default role matrix (seeded once; editable afterwards)
| Role | Permissions |
|---|---|
| Super Admin | all |
| Admin | all except `roles.manage`, `permissions.manage`, `settings.manage` |
| Manager | dashboard, products.view, orders view/update/cancel/assign, customers.view, inventory.view, designs view/assign/approve, deliveries view/assign, payments.view, support.view, reports.view, staff.view |
| Designer | dashboard, designs `view_assigned`/create/update |
| Staff | dashboard, products.view, orders `view_assigned`/update, inventory.view |
| Delivery Captain | deliveries `view_assigned`/`update_assigned` **only** (no dashboard; lands on the deliveries workspace in Phase 8) |
| Inventory Manager | dashboard, products.view, inventory view/manage, reports.view |
| Customer Support | dashboard, customers.view, orders.view, support view/manage, reviews.moderate |
| Finance Manager | dashboard, orders.view, payments view/refund, reports view/export |

## Privilege-escalation rules `[fact]` (`packages/rbac/src/guards.ts`, tested)
1. The `super_admin` role cannot be edited.
2. Editing role permissions requires `permissions.manage`. You can only **grant** permissions you hold yourself.
3. Assigning roles requires `staff.manage`. You cannot change **your own** roles.
4. Only a Super Admin can grant or revoke `super_admin`.
5. You cannot assign a role with more access than your own.
6. You cannot edit or deactivate someone who holds access you lack. Only a Super Admin manages another Super Admin (`assertCanManageTarget`).
7. At least one active Super Admin must always remain. The check locks every Super Admin assignment row (`FOR UPDATE`), so two Super Admins demoting each other at the same time cannot leave zero.
8. Every staff, role and permission change writes an `audit_logs` row **in the same transaction**. A denied action writes nothing.

## Management UI (Phase 2)
| Route | Permission |
|---|---|
| `/admin/staff`, `/staff/[id]` | `staff.view` (editing needs `staff.manage`) |
| `/admin/staff/new` | `staff.manage` |
| `/admin/roles` | any of `roles.manage`, `permissions.manage`, `staff.view` |
| `/admin/permissions` | `permissions.manage` (or read-only with `roles.manage`) |
| `/admin/audit-logs` | `audit_logs.view` |

The UI mirrors the rules for clarity: locked roles show the reason, and the matrix disables what you can't grant. The server enforces every rule independently.

## Where it is enforced
- **Admin pages**: `requireStaff("<perm>")` at the top of every page.
- **Admin APIs**: `apiRoute` requires a staff session, and each `@ecom/services` function checks its own permission. Never in middleware alone.
- **Customer APIs**: the identity always comes from the verified session. Customer IDs supplied by the browser are ignored.
- **Dashboard**: each metric is computed only if the actor holds the permission that reveals it (`lib/queries/dashboard.ts`).

## Tests
- `packages/rbac/src/rbac.test.ts`: 17 unit tests covering the matrix invariants, guards, assignment scope, ownership and escalation.
- `packages/services/src/staff-roles.integration.test.ts`: 21 tests covering management permissions, escalation, last Super Admin, session revocation, IDOR, audit and the invite flow.
- `packages/auth/src/auth.integration.test.ts`: 9 tests on the real DB, covering staff-only admin sessions, suspended accounts, no self-promotion and exact permission loading.
- `scripts/smoke.mjs`: over HTTP, a customer cookie does not open admin, and a customer is refused an admin session.
