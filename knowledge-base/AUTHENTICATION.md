# Authentication

**Better Auth 1.7.18** on our own Postgres tables (`users`, `sessions`, `accounts`, `verifications`). Configured once in `packages/auth/src/server.ts` and mounted by each app.

| | Storefront (`createAuth("web")`) | Admin (`createAuth("admin")`) |
|---|---|---|
| Endpoint | `/api/auth/*` | `/admin/api/auth/*` |
| Cookie prefix | `ecom` | `ecom_admin` |
| Sign-up | open (customers) | **disabled**; staff are created by an admin (Phase 2) |
| Who may hold a session | any active user | **only users with ≥1 role**, enforced in the `session.create.before` hook |
| Session lifetime | 30 days (refreshed every 4 h) | 12 hours |
| Methods | email + password, email OTP | email + password (OTP available) |

## Behaviour `[fact]`, covered by tests or the smoke script
- Passwords: 8–128 characters, hashed by Better Auth (scrypt). Reset tokens expire after 30 min, and a reset revokes all of that user's sessions.
- Email OTP: 6 digits, 5-minute expiry, 5 attempts. Customers can be allowed or blocked from using it via the `auth.customer_otp_enabled` setting. The storefront UI arrives in Phase 5.
- Suspended or soft-deleted users cannot create a session in either app.
- A wrong password and an unknown email return the same message (no account enumeration).
- **Rate limits** (per IP): sign-in 5/min, sign-up 5/min, password reset 3 per 5 min, OTP send 3/min. Default is 100/min.
  - Storage is **in-memory per instance**. That is fine for one instance per service. Before scaling horizontally, move it to Redis secondary storage (tracked in IMPLEMENTATION_PLAN).
- **CSRF**: Better Auth rejects requests whose `Origin` is not in `trustedOrigins` (`WEB_URL`, `ADMIN_URL`). The smoke test confirms a cross-origin sign-in gets 403.
- Cookies are `httpOnly` and `SameSite=Lax`, with `Secure` in production.
- Emails go through Resend (REST, no SDK). Without `RESEND_API_KEY`, emails are logged in dev and refused with an error log in production.

## Server helpers
- `getAuth()` (in each app's `lib/auth.ts`): lazily created instance, so builds need no secrets.
- `getStaffSession()` / `requireStaff(permission?)` in `apps/admin/lib/session.ts`.
- `loadActor(userId)` in `@ecom/auth`: roles and permissions from the DB, or `null` for inactive users.

## Bootstrapping the first Super Admin
Set `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` / `SEED_SUPERADMIN_NAME`, then run `pnpm db:seed` (or `node db/seed.mjs` in the production image). The seed creates the user only if the email doesn't exist yet. In production the password must be at least 12 characters. Change it after first login; a password-change UI arrives in Phase 2.

## Staff invitations (Phase 2) `[fact]`
1. An admin creates the staff member (`POST /admin/api/staff`). The account is created **without a password**.
2. The handler calls Better Auth `requestPasswordReset`. Because the user has no credential account yet, the email is worded as an invitation ("Set your password").
3. The link (single use, **24 h** in admin, 30 min on the storefront) opens `/admin/reset-password?token=…`. Setting the password creates the credential account (Better Auth `utils/password.mjs:35`), marks the email verified, and revokes any sessions.
4. "Resend invitation" or "Send password reset" on the staff page issues a fresh link.

Staff passwords need at least **10** characters, enforced by Better Auth for the admin app. The forms also require letters plus digits. Customers need at least 8.

## Not yet built
- Customer sign-in and sign-up pages, account area and guest checkout: Phase 5
- A staff "active sessions" list: Phase 10
- Phone or SMS OTP: needs an SMS provider. Not yet decided; see OPEN_QUESTIONS.
