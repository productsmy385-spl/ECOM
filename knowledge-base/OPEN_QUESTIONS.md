# Open questions and decisions

## Resolved
| # | Date | Question | Decision |
|---|---|---|---|
| 1 | 2026-11-10 | Tenancy model | Single business. Not SaaS, not multi-tenant. Strict customer-level and role-level data isolation. |
| 2 | 2026-11-10 | Admin reference | DropX Admin (replaces AutoMark) |
| 3 | 2026-11-10 | Auth provider | ~~Better Auth on Postgres~~. **Superseded by 3a.** |
| 3a | 2026-11-11 | Auth provider | **Clerk** for sign-in, sign-up and staff invitations (user's request, 2026-11-11). It supersedes #3. Our `users` table, RBAC and data isolation are unchanged; `users.clerk_user_id` links the two by verified email. Better Auth's tables were dropped (migration 0003). |
| 4 | 2026-11-10 | Linear tracking | Skipped for now. Progress lives in IMPLEMENTATION_PLAN.md. |
| 5 | 2026-11-10 | Brand name | Placeholder "Crimsonne" via `NEXT_PUBLIC_BRAND_NAME` |
| 6 | 2026-11-10 | Bookly credit | Omitted. Bookly is inspiration only, and no code or assets ship. |
| 7 | 2026-11-10 | DropX credit | **Kept**, as the licence requires: admin footer and login footer |
| 8 | 2026-11-10 | Master prompt truncated after §19 | Proceeding on the assumption that §20+ match the first prompt (entity list, security, docs, phases, deliverables) `[assumption]` |
| 9 | 2026-11-10 | Admin URL shape | Separate Next app with `basePath: "/admin"`, so routes match the spec |
| 10 | 2026-11-10 | Money representation | Integer paise. Prices are GST-inclusive. |
| 11 | 2026-11-10 | RLS | Deferred. Backend enforcement plus tests now; revisit with the services layer. |
| 13 | 2026-11-11 | Stock reservation | Stock is reserved at **order placement** (`inventory.reserve_on = order_placed`), inside the checkout transaction. A guarded UPDATE does it, backed by the `reserved <= on_hand` CHECK. Unpaid Razorpay orders release their stock after `payment_hold_minutes` (default 30). Both defaults can be changed in Checkout settings. |
| 14 | 2026-11-11 | Hold-expiry job | Runs in-process in the storefront (`apps/web/instrumentation.ts`, every 5 min) rather than in BullMQ, because Redis isn't provisioned on Railway and there is one storefront replica. The sweep is idempotent and uses SKIP LOCKED. Revisit when Redis is added. |
| 15 | 2026-11-11 | Guest cart identity | The httpOnly guest cookie that owns guest designs (`ecom_design_owner`) also owns the guest cart. On sign-in, both the designs and the cart move to the account. |
| 16 | 2026-11-11 | Guest order access | Guests get a secret link, `/orders/<number>?t=<token>`. Only the token's SHA-256 is stored (`orders.guest_access_hash`). |
| 17 | 2026-11-11 | Designs in the cart | A design can be ordered once it is `submitted`, `in_review` or `approved`. An unapproved design moves the order to `design_review` after payment instead of `confirmed`. Products with required options can only be bought through a design. |
| 18 | 2026-11-11 | Shipping GST | Shipping fees are charged as flat amounts, and GST is extracted from item lines only. `[assumption]`: needs confirming with the accountant (open item G). |
| 12 | 2026-11-10 | better-auth version | Pinned 1.7.18. 1.7.19 was newer than pnpm's release-age guard, and the guard was not bypassed. (Moot since 3a: Better Auth was removed.) |

## Open
| # | Question | Needed by |
|---|---|---|
| A | Real brand name and logo | Phase 3 |
| B | Real product and banner photography (the Bookly images are book-themed and unusable) | Phase 3 |
| C | GST rate per category; shipping fees and thresholds; whether COD and guest checkout are on at launch. All are editable in **Admin → Checkout settings**. Defaults: guest checkout on, COD off, free shipping from ₹999, standard ₹49, express ₹149. | Go-live |
| G | Is GST charged on the shipping fee, and at what rate? The invoice layout needs this. | Phase 7 |
| H | Razorpay keys (test mode first) and the webhook secret. Until they are set, checkout offers only cash on delivery, and only if an admin enables it. | Go-live |
| D | Razorpay, ImageKit, Resend and Railway credentials (test mode first) | Phases 4–6 + deploy |
| E | Phone/SMS sign-in, if wanted: Clerk supports it (paid add-on in production); not enabled | Phase 5 |
| F | One domain (`/admin` proxied) or a separate admin domain? | Deploy |
