# Environment variables

Template: [`/.env.example`](../.env.example). Locally there is a single root `.env`. On Railway, set them as service variables. `NEXT_PUBLIC_*` values are inlined into the browser bundle at **build** time; everything else is server-only.

| Variable | Used by | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | all | yes | Railway: reference the Postgres service variable. Use the private network URL in production. |
| `TEST_DATABASE_URL` | tests | tests | Must differ from `DATABASE_URL` |
| `DATABASE_POOL_MAX` | apps | no | Default 10 per instance. Keep `instances × pool` below Postgres `max_connections`. |
| `MIGRATIONS_DIR` | migrate bundle | image | Set in the Dockerfile |
| `REDIS_URL` | jobs/cache | Phase 6+ | |
| `BETTER_AUTH_SECRET` | apps | yes | ≥32 random bytes. **Same value in web and admin.** Rotating it signs everyone out. |
| `WEB_URL` / `ADMIN_URL` | apps | yes | Public origins with no path (admin's `/admin` basePath is added in code). Also the CSRF allow-list. |
| `SEED_SUPERADMIN_EMAIL` / `_PASSWORD` / `_NAME` | seed | first run | Remove from Railway after bootstrapping |
| `NEXT_PUBLIC_BRAND_NAME` | apps | no | Placeholder "Crimsonne" |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | web | no | |
| `RESEND_API_KEY`, `EMAIL_FROM` | auth/notifications | prod | Empty means emails are logged (dev only) |
| `RAZORPAY_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | payments | Phase 6 | |
| `IMAGEKIT_PUBLIC_KEY` / `_PRIVATE_KEY` / `_URL_ENDPOINT` | uploads | Phase 4 | |
| `FCM_PROJECT_ID` / `_CLIENT_EMAIL` / `_PRIVATE_KEY` | push | Phase 8 | |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | delivery | Phase 8 | Restrict the key by HTTP referrer |
| `APP` | Docker / Railway | image | `web` or `admin`. Selects which app the image builds and runs. |
