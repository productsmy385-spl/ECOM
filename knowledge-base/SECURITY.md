# Security

## In place (Phase 1) `[fact]`
| Area | Control |
|---|---|
| AuthN | Better Auth sessions with httpOnly cookies, separate cookies and endpoints for customers and staff. Admin sessions are refused to users without roles. |
| AuthZ | Database-driven RBAC re-read per request. Guards in `@ecom/rbac`. A page guard on every admin page. Escalation rules tested. |
| Data isolation | Identity always comes from the verified session. Assignment-scoped permissions (`*_assigned`). Respond 404 on denied record access. |
| Brute force | Per-route rate limits on sign-in, sign-up, reset and OTP |
| CSRF | Origin allow-list (`trustedOrigins`), SameSite cookies |
| Injection | Drizzle parameterised queries only. No string-built SQL with user input. |
| XSS | React escaping. Email HTML escapes every interpolated value (`simpleEmail`). |
| Headers | `X-Frame-Options` (DENY admin / SAMEORIGIN web), `nosniff`, `Referrer-Policy`, `Permissions-Policy`. Admin sends `X-Robots-Tag: noindex`. `X-Powered-By` is off. |
| Integrity | DB CHECKs (no oversell, refund ≤ payment), unique idempotency keys, append-only ledgers |
| Secrets | Only `.env.example` is committed. `.env*` is git- and docker-ignored. Secrets are never logged. |
| Supply chain | pnpm `minimumReleaseAge` is respected (better-auth was pinned to an older, mature release instead of bypassing it). Install scripts are allow-listed (`allowBuilds`). |
| Container | Non-root user, standalone output, no dev dependencies in the runtime image |

## Planned, by phase
- **Phase 2**: audit log writes for all role, permission, staff and settings changes. Admin API route-handler guard.
- **Phase 4**: upload validation (type, size, magic bytes) and signed ImageKit uploads.
- **Phase 6**: Razorpay signature and webhook HMAC verification, idempotent event processing, server-side amount recalculation.
- **Before scale-out**: Redis-backed rate limiting.
- **Under evaluation**: Postgres RLS for customer-owned tables. Needs `set_config('app.user_id', …, true)` inside each transaction so pooled connections never leak context. Backend checks stay mandatory regardless.
- **Before launch**: a Content-Security-Policy (once the Razorpay/ImageKit/Maps origins are known).
