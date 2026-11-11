# Authentication

**Clerk** handles sign-in, sign-up, passwords, Google sign-in, email verification, new-device checks, sessions and staff invitation emails. **Our database** stays the source of truth for who a person is in the store and what they may do: our `users` row, their roles and permissions (RBAC), status (active or suspended), addresses, designs and orders.

This replaced Better Auth on 2026-11-11 (OPEN_QUESTIONS decision #3a). The `sessions`, `accounts` and `verifications` tables were dropped in migration `0003_clerk_identity`.

One Clerk application serves both apps: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. It is currently a **development instance** (`pk_test_`/`sk_test_`). That instance shows a "Development mode" badge and has usage limits. Create a production instance and a custom domain before launch (see "Before launch").

## How a Clerk user becomes one of our users `[fact]`
`users.clerk_user_id` (unique, nullable) links the two. The logic is in `resolveClerkUser()` in `packages/auth/src/identity.ts`:

1. **Already linked:** one indexed query. No call to Clerk.
2. **Not linked yet:** fetch the Clerk user. If their **primary email is verified**, link the existing `users` row with that email (case-insensitive). This is how the seeded owner, invited staff and pre-Clerk customers keep their roles and history.
3. **No row with that email:** create a customer row and its `customer_profiles` row. **It is never staff.** Staff access only comes from roles granted in the admin.

The function refuses (returns `null`) in three cases:
- the email is unverified;
- the account is closed (soft-deleted);
- the identity doesn't match the session's Clerk user.

`loadActor()` re-reads roles and permissions on **every request**, so suspensions and role changes apply immediately.

## Per app
| | Storefront (`apps/web`) | Admin (`apps/admin`, basePath `/admin`) |
|---|---|---|
| Session | `clerkMiddleware()` in `proxy.ts` | same |
| Server helper | `getCustomerState()` / `getCustomer()` / `requireCustomer()` in `lib/customer.ts` | `getAdminAuthState()` / `requireStaff(permission?)` in `lib/session.ts` |
| Sign-in page | `/login`: Clerk `<SignIn routing="hash">`, honours `?next=` (via `safeNext`) | `/admin/login`: `<SignIn>`, with the sign-up link hidden |
| Sign-up | `/register`: open to customers | `/admin/accept-invite`: needs an invitation ticket (`__clerk_ticket`), otherwise shows "open the link in your email" |
| Signed in but not allowed | `AccountUnavailable` (suspended, closed or unverified) with sign-out | `/admin/no-access` with "sign out and use another account" |
| Security settings | `/account/profile` embeds `<UserProfile>` (password, email, connected accounts, devices) | `/admin/account` embeds `<UserProfile>` |

Admin guards work like this:
- Signed out goes to `/admin/login`.
- Signed in, but not active staff, goes to `/admin/no-access`.
- Staff without the needed permission go to `/admin/forbidden`.
- API routes return 401 or 403 (`apiRoute` in `lib/api.ts`).

A customer's Clerk session never opens the admin (smoke-tested).

## Staff invitations `[fact]`
1. An admin creates the staff member (`POST /admin/api/staff`). This creates our row and roles, with no credentials.
2. The route calls `sendClerkInvitation()` with a redirect to `<ADMIN_URL>/admin/accept-invite`, valid for **7 days**, with `ignoreExisting: true`. Clerk sends the email, so no Resend key is needed.
3. The person opens the link and creates their sign-in (password or Google). The email is fixed by the ticket and already verified.
4. Their first request links the Clerk user to the staff row by email. The staff page then shows **Joined** instead of **Invitation pending**.
5. "Resend invitation" appears only while the invitation is pending. If the email already has a Clerk account, the API answers `alreadyHasAccount`; they simply sign in.

Forgotten passwords are reset from Clerk's sign-in screen.

**Deactivating** a staff member sets `status = suspended`, so every request is refused from then on. The route also revokes their active Clerk sessions (best effort, `revokeClerkSessions`).

## Bootstrapping the first Super Admin
1. Set `SEED_SUPERADMIN_EMAIL` (and optionally `SEED_SUPERADMIN_NAME`), then run `pnpm db:seed` (in production: `node db/seed.mjs`). This creates the staff row and the Super Admin role only. There is no password.
2. The owner opens `/admin/login` and signs in through Clerk with that email: Google, or "Sign up" via an invitation.

The production owner row (`saycheeselive@gmail.com`) already exists from the Better Auth era. It links on the owner's first Clerk sign-in.

## Webhook (optional)
`POST /api/webhooks/clerk` on the storefront is Svix-verified with `CLERK_WEBHOOK_SIGNING_SECRET`.
- `user.updated` syncs name, verified email and photo.
- `user.deleted` unlinks `clerk_user_id`. The row keeps its orders and history.

It never changes roles or status. Without the secret it returns 503 and sign-in still works, because linking happens on first request.

## Other behaviour
- **CSRF:** our API wrappers reject cross-origin writes (Origin check). Clerk's session cookie is SameSite=Lax.
- **Guest designs** are claimed into the account on the first signed-in request (`lib/design-owner.ts`).
- **Customer APIs** take the user id only from the session: 401 when signed out, 404 for others' records.
- **Rate limiting and bot protection** for sign-in and sign-up are Clerk's (configured in the Clerk dashboard).
- Tests never call Clerk. Identity resolution is tested with injected identities (`packages/auth/src/auth.integration.test.ts`). Browser flows use `@clerk/testing` testing tokens and `+clerk_test` email addresses; verification code `424242`.

## Before launch
- Create a Clerk **production instance**. Point `clerk.<domain>` and `accounts.<domain>` DNS at it, and swap in the `pk_live_`/`sk_live_` keys in Railway. Production instances need a real domain; Railway's `*.up.railway.app` isn't one.
- In the Clerk dashboard, consider **restricting sign-ups** or enabling the allowlist if the storefront should be invite-only. It isn't now.
- Add the webhook endpoint and its secret.

## Not yet built
- Guest checkout (Phase 6)
- Phone/SMS sign-in: available in Clerk, but not enabled. See OPEN_QUESTIONS.
