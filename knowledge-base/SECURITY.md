# Security

## In place (Phase 1) `[fact]`
| Area | Control |
|---|---|
| AuthN | Clerk sessions (short-lived JWT plus httpOnly client cookie), verified by `clerkMiddleware`. Clerk users are linked to our `users` rows only by **verified** email. Admin access needs an active user with at least one role, re-checked on every request. |
| AuthZ | Database-driven RBAC re-read per request. Guards in `@ecom/rbac`. A page guard on every admin page. Escalation rules tested. |
| Data isolation | Identity always comes from the verified session. Assignment-scoped permissions (`*_assigned`). Respond 404 on denied record access. |
| Brute force | Clerk's sign-in protection: rate limits, bot protection and new-device email verification ("client trust"). |
| CSRF | Origin allow-list (`trustedOrigins`), SameSite cookies |
| Injection | Drizzle parameterised queries only. No string-built SQL with user input. |
| XSS | React escaping. Email HTML escapes every interpolated value (`simpleEmail`). |
| Headers | `X-Frame-Options` (DENY admin / SAMEORIGIN web), `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Admin sends `X-Robots-Tag: noindex`. `X-Powered-By` is off. |
| Integrity | DB CHECKs (no oversell, refund ≤ payment), unique idempotency keys, append-only ledgers |
| Secrets | Only `.env.example` is committed. `.env*` is git- and docker-ignored. Secrets are never logged. |
| Supply chain | pnpm `minimumReleaseAge` is respected (e.g. a library was pinned to an older, mature release instead of bypassing it). Install scripts are allow-listed (`allowBuilds`). |
| Container | Non-root user, standalone output, no dev dependencies in the runtime image |

## Added in Phase 3 `[fact]`
- **Storefront reads are restricted** to published products in active categories. Exact stock counts, costs, drafts and soft-deleted rows are never exposed (checked by the smoke test).
- **Image uploads**: the browser uploads straight to ImageKit using a server-issued, 30-minute HMAC signature. The private key never reaches the client. Product and category image URLs must be `https://ik.imagekit.io/…` (Zod). Client-side checks: JPG/PNG/WebP/AVIF, ≤ 5 MB. **Also set ImageKit's upload restrictions (file types and size) in its dashboard** as server-side enforcement.
- **Public endpoints are rate limited** (suggest 60/min, product 120/min, newsletter 5/min per IP). The newsletter is same-origin only and gives the same response whether or not an address was already subscribed.
- `JSON-LD` is serialised with `<` escaped.

## Planned, by phase
- **Phase 2**: audit log writes for all role, permission, staff and settings changes. Admin API route-handler guard.
- **Phase 4**: customer design uploads, with stricter handling (moderation and per-customer folders).
- **Phase 6 (done 2026-11-11)** `[fact]`:
  - **Amounts** are never taken from the client. The cart is re-priced from the catalogue inside the checkout transaction.
  - **Payments:** the Razorpay signature is checked with HMAC-SHA256 and a timing-safe compare, then the payment is re-fetched from Razorpay, with order id and amount matched, before an order is marked paid. The webhook is checked by HMAC over the raw body. Events are stored once (unique provider + event id), and processing is idempotent and row-locked.
  - **Overselling** is impossible: a guarded `reserved + q <= on_hand` update, plus the CHECK constraint. Variants are locked in sorted order, so concurrent checkouts can't deadlock.
  - **Coupon limits** hold under concurrency (`FOR UPDATE` on the coupon row). The coupon endpoint is limited to 10/min per IP against guessing.
  - **Guest orders** are only readable with their secret token; just its SHA-256 is stored. Without it, the order page and APIs answer 404.
  - **Cart lines** and orders of other shoppers read as 404. All write endpoints are same-origin only.
- **Before scale-out**: Redis-backed rate limiting.
- **Under evaluation**: Postgres RLS for customer-owned tables. Needs `set_config('app.user_id', …, true)` inside each transaction so pooled connections never leak context. Backend checks stay mandatory regardless.
- **Content-Security-Policy (done 2026-11-11, Phase 10)** `[fact]`:
  - Both apps send it, built by `packages/ui/src/security-headers.ts`.
  - **Allowed origins.** Scripts, frames and connections may reach only:
    - Clerk: its Frontend API host, decoded from `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at build time, plus `cdn.protect.clerk.com`;
    - Cloudflare Turnstile;
    - Razorpay (storefront only);
    - ImageKit.
  - **Blocked outright:** `object-src 'none'`, `base-uri 'self'`, form posts to other sites, and framing (admin: `frame-ancestors 'none'`).
  - **Inline scripts:** `script-src` keeps `'unsafe-inline'` because Next.js inlines its bootstrap. Nonces would make every page dynamic.
  - **Other headers:** HSTS (1 year) in production, and COOP `same-origin-allow-popups`, which Razorpay's popup flow needs.
  - **Check:** the Playwright suite (`pnpm e2e`) fails on any CSP violation.
  - **Not yet covered:** a signed-in checkout with Razorpay keys, and the admin ImageKit upload. Re-run e2e and smoke tests when the keys are set.
- **Rate limiting** stays in-memory per instance (`apps/web/lib/rate-limit.ts`). That is correct while each app runs one replica (OPEN_QUESTIONS #14: Redis isn't provisioned). It must move to Redis before scaling out.
- **Report exports:** CSV cells starting with `= + - @` are prefixed with `'` so spreadsheets don't run them as formulas. XLSX writes text as inline strings, which are never formulas.
