# Open questions and decisions

## Resolved
| # | Date | Question | Decision |
|---|---|---|---|
| 1 | 2026-11-10 | Tenancy model | Single business. Not SaaS, not multi-tenant. Strict customer-level and role-level data isolation. |
| 2 | 2026-11-10 | Admin reference | DropX Admin (replaces AutoMark) |
| 3 | 2026-11-10 | Auth provider | **Better Auth on Postgres** (replaces Clerk from the first prompt) |
| 4 | 2026-11-10 | Linear tracking | Skipped for now. Progress lives in IMPLEMENTATION_PLAN.md. |
| 5 | 2026-11-10 | Brand name | Placeholder "Crimsonne" via `NEXT_PUBLIC_BRAND_NAME` |
| 6 | 2026-11-10 | Bookly credit | Omitted. Bookly is inspiration only, and no code or assets ship. |
| 7 | 2026-11-10 | DropX credit | **Kept**, as the licence requires: admin footer and login footer |
| 8 | 2026-11-10 | Master prompt truncated after §19 | Proceeding on the assumption that §20+ match the first prompt (entity list, security, docs, phases, deliverables) `[assumption]` |
| 9 | 2026-11-10 | Admin URL shape | Separate Next app with `basePath: "/admin"`, so routes match the spec |
| 10 | 2026-11-10 | Money representation | Integer paise. Prices are GST-inclusive. |
| 11 | 2026-11-10 | RLS | Deferred. Backend enforcement plus tests now; revisit with the services layer. |
| 12 | 2026-11-10 | better-auth version | Pinned 1.7.18. 1.7.19 was newer than pnpm's release-age guard, and the guard was not bypassed. |

## Open
| # | Question | Needed by |
|---|---|---|
| A | Real brand name and logo | Phase 3 |
| B | Real product and banner photography (the Bookly images are book-themed and unusable) | Phase 3 |
| C | GST rate per category, shipping fees and thresholds. Is COD on at launch? Is guest checkout on? (Defaults are seeded in `system_settings`.) | Phase 6 |
| D | Razorpay, ImageKit, Resend and Railway credentials (test mode first) | Phases 4–6 + deploy |
| E | SMS provider for phone OTP, if wanted (email OTP is built) | Phase 5 |
| F | One domain (`/admin` proxied) or a separate admin domain? | Deploy |
