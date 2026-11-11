# Reference Analysis

Status: Phase 1, step 1. Written 2026-11-10, before any implementation code.
Originals left untouched in `~/Downloads`. Extracted copies are in `_reference/` (read-only; do not ship).

Tags: `[fact]` verified in the source, `[assumption]` not yet verified, `[proposed]` a recommendation.

---

## A. DropX Admin (`dropx-admin-v1.0.0.zip`), the admin dashboard reference

### Stack `[fact]` (`_reference/dropx/package.json`)
| Concern | DropX uses | Our target | Action |
|---|---|---|---|
| Framework | Next.js 16.4.5, React 19.2.8 | Next.js 16, React 19 | Keep |
| Styling | Tailwind v4, CSS tokens in `app/globals.css` (`@theme inline`) | Tailwind v4 | Keep the token structure and swap in the brand palette |
| UI kit | Hand-rolled primitives in `components/ui/` (CVA + tailwind-merge) | shadcn/ui + Radix | Merge the two. The DropX primitives already follow the shadcn pattern; add Radix-based shadcn pieces (Dialog, DropdownMenu, Popover, Tabs, Sheet) where DropX has none |
| State | Redux Toolkit (only `sidebar-slice.ts`) | TanStack Query | **Drop Redux.** It only holds sidebar state, so use a small context or cookie instead |
| Charts | Recharts 3, themed by `lib/chart-theme.ts` | Not specified | Keep Recharts |
| Maps | Leaflet | Google Maps (delivery) | Drop Leaflet |
| Toasts | sonner | Toasts required | Keep |
| Theme | next-themes, class-based dark mode | Light and dark | Keep |
| Icons | lucide-react | lucide-react | Keep |
| Font | Geist | Sora + Inter | Replace |
| Backend | None. All data is typed mocks in `data/` | Postgres + Drizzle | Replace every mock with real queries |

### What to reuse `[fact]`
- **Layout shell**: `components/layout/` covers the sidebar (6.4 KB), header, user menu, breadcrumb, page header and footer. The sidebar, breadcrumb and sitemap are all generated from `config/navigation.ts`. That makes permission-filtered navigation easy: filter the config by the user's permissions before rendering it.
- **Primitives**: `components/ui/` provides Button, Card, Input, Select, Textarea, Checkbox, Badge, Avatar, Skeleton, EmptyState, AdvancedTable (13 KB, with sorting, filtering and pagination), AnimatedCounter and Logo.
- **E-commerce screens**, used as layout references for our admin modules:
  - `app/(admin)/dashboard/ecommerce/view.tsx` and `dashboard/_components/dashboard-content.tsx`: metric cards and charts
  - `app/(admin)/app/ecommerce/products/{view,grid,details,new}`: product list, grid, detail and create pages
  - `app/(admin)/app/ecommerce/orders/{view,details}`, `customers/{view,details}`, `invoice/view.tsx`
- **Auth screens**: `app/(auth)/auth/{card,simple,split}/*`. Pick one variant, the split layout `[proposed]`.
- **Page convention**: `page.tsx` is a server file that exports `metadata`, and `view.tsx` is the client UI. We keep this convention.

### What to remove `[fact]`
These modules have nothing to do with the business and are deleted: `app/(admin)/app/{calendar,chat,e-learning,email,events,kanban,social}`, `dashboard/{analytics,crm,lms,management,saas,support-desk}`, the whole `components/` showcase, `utilities/`, `modules/icons`, `pages/{landing,pricing,faq,misc}`, the auth variants we don't use, `data/{crm,lms}.ts`, Leaflet and Redux.
Support-desk ticket screens (`app/support-desk/tickets`) are a candidate to keep as a reference for our support-ticket module `[proposed]`.

### License `[fact]` (`_reference/dropx/LICENSE`, MIT-based)
- **Attribution is mandatory**: "Designed & developed by DataDropX" with a link to https://datadropx.net must stay visible in the UI, by default in the footer. It may be restyled, but it must stay readable and linked. Do not remove `BrandCredit` (footer and auth layout).
- Selling the template itself as a paid template is not allowed. Selling the business application built on it is allowed.
- **Impact**: the admin footer and the admin login page will show the DataDropX credit.
- **Update 2026-11-11**: the owner chose to remove this credit, after being told about the licence condition. See OPEN_QUESTIONS #7a.

---

## B. Bookly (`Bookly-v1.0.0.zip`), the public storefront reference

### Stack `[fact]`
Static HTML: a single 94 KB `index.html`, Bootstrap 5.3.3 and jQuery 1.11 from CDN, Swiper 9, Chocolat/Magnific lightboxes, the Nunito font and an inline SVG icon sprite. Bookly contains no framework, no components and no data layer, so **nothing can be reused as code**. We rebuild its visual patterns as React and Tailwind components.

### Page anatomy, mapped to our homepage `[fact]` (`index.html` line numbers)
| Bookly section | Line | Our equivalent |
|---|---|---|
| Search overlay | 156 | Header search with database-driven suggestions |
| `header#header` + offcanvas nav | 192–222 | Announcement bar, logo, mega-nav, search, account, wishlist and cart; mobile drawer |
| Sign-in/register modal | 295–334 | Replaced by real auth pages |
| `#billboard` hero (Swiper) | 454 | Hero carousel, managed by admins |
| `#company-services` | 526 | Trust strip (free shipping, quality, secure payment) |
| `#best-selling-items` | 585 | Best sellers rail |
| `#limited-offer` with countdown | 878 | Promotional banner with countdown, coupon-driven |
| `#items-listing` (tabbed) | 917 | Trending, new arrivals and custom-designed tabs |
| `#categories` | 1297 | Featured categories |
| `#customers-reviews` | 1334 | Reviews carousel (real approved reviews) |
| `#latest-posts` | 1476 | **Drop.** No blog in scope |
| `#instagram` | 1518 | Optional, deferred |
| `footer#footer` | 1600 | Footer plus newsletter |

Bookly has **no** listing page with filters, product detail page, checkout or account area. We design those ourselves to the Flipkart and Amazon UX standard. Bookly only contributes the home and header visual language.

### Assets `[fact]`
76 images in `images/`, all book-themed demo photography (credited to Unsplash, Freepik and Pexels). **None of them suit a cosmetics or eyewear store, so none are reused.** We need real product and banner photography from the business. Until it arrives, admins upload images through ImageKit, and the UI shows designed empty and placeholder states instead of stock book images.

### License `[fact]` (`_reference/bookly/readme.txt`)
Free for commercial use, provided the TemplatesJungle credit link in the footer stays, unless the paid No-Attribution version is bought.
**Open point**: we rebuild only the layout patterns in a different stack and reuse none of its code or assets, so this is arguably inspiration rather than use of the template. Whether to keep the credit anyway is a business and legal decision, recorded in `OPEN_QUESTIONS.md` `[assumption]`.

---

## C. Architecture differences and how they reconcile

| Difference | Resolution `[proposed]` |
|---|---|
| DropX is a full Next.js app; Bookly is static HTML | Both become Next.js 16 apps in one pnpm monorepo, sharing `packages/ui` and the brand tokens |
| DropX's indigo `#6366f1` primary color and Geist font | Replaced by brand tokens: Crimson `#CF0F47` primary, Hot Pink `#FF0B55` accent, Light Pink `#FFDEDE` surface, plus Sora and Inter |
| Bootstrap and jQuery (Bookly) | Not carried over |
| DropX uses mock data everywhere | Every view reads through TanStack Query from REST route handlers backed by Drizzle and Postgres |
| Redux (DropX) | Removed |

## D. Proposed unified structure `[proposed]`

```
ecom/
  apps/
    web/        Next.js 16 storefront (Bookly-inspired); also hosts /api/* REST handlers
    admin/      Next.js 16 admin (DropX-based), including the /delivery mobile-first workspace
  packages/
    db/         Drizzle schema, migrations, seed, repositories
    auth/       session verification and the current-user helper
    rbac/       permission constants, can(), requirePermission(), ownership guards
    services/   domain services: catalog, cart, pricing, orders, payments, inventory, designs, delivery, notifications
    validation/ Zod schemas shared by API and forms
    ui/         design tokens and shared primitives
    config/     tsconfig, eslint
  knowledge-base/
  docker/       docker-compose for local Postgres and Redis
  railway.toml
```

Business logic lives only in `packages/services`. The route handlers in both apps stay thin: authenticate, authorize, validate, call the service, then return the result. A future Expo app can call the same REST API.
