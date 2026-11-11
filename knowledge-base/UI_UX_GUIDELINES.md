# UI/UX guidelines

Tokens live in `packages/ui/src/tokens.css` and both apps import them. **Never hard-code hex values in components.** Use the token classes.

## Colour `[fact]` (contrast measured, WCAG 2.1)
| Token class | Light | Use |
|---|---|---|
| `bg-primary` / `text-primary-foreground` | Crimson `#CF0F47` / white (5.51:1, passes AA) | Primary buttons, active nav, primary badges |
| `hover:bg-primary-hover` | `#A80C3A` | Primary hover |
| `text-highlight`, `ring` | Hot Pink `#FF0B55` | Accents, focus rings, large display text. **Never white text on hot pink** (3.87:1 fails AA); text on it must be black (5.43:1). |
| `bg-accent` / `bg-blush` | Light Pink `#FFDEDE` | Soft chips, tinted surfaces. Text on it must be black, because crimson only reaches 4.39:1. |
| `bg-ink` | Black `#000000` | Announcement bar, dark hero panels |
| `text-link` | crimson (light) / `#FF4D7E` (dark, 6.19:1) | Links |
| `success` `warning` `info` `destructive` | | Status only, never decorative |

Dark mode is class-based (`next-themes`) in admin. The storefront is light-only for now `[proposed]`.

## Typography
- **Sora** (`font-display`): headings, buttons, navigation, prices, metric values. It is applied automatically to `h1`–`h6` and `button`.
- **Inter** (`font-sans` / body): body copy, forms and tables.
- Smallest text is `text-2xs` (11px).

## Shape and elevation
- Radius: chips `rounded-md`, buttons and inputs `rounded-lg`, cards `rounded-xl`, hero and media `rounded-2xl`, pills `rounded-full`.
- Shadows: `shadow-card` (resting), `shadow-dropdown` (menus, hover), `shadow-modal` (dialogs), `shadow-product` (storefront product hover).
- No decorative gradients and no glassmorphism. The DropX `gradient` button variant was removed.

## Layout
- Storefront content uses `container-store`: max 1320px, with 16px / 24px / 32px gutters.
- Admin content is capped at 1440px. Page padding is `p-4 lg:p-6`. Every page starts with `<PageHeader>`.
- Breakpoints are checked at 390 (mobile), 768 (tablet) and 1440 (desktop). There must be no horizontal page scroll; the Playwright check asserts `scrollWidth <= clientWidth`.

## Components and behaviour
- Admin primitives come from DropX (`apps/admin/components/ui`): Button, Card, Input (with label, error and hint), Select, Textarea, Checkbox, Badge, Avatar, Skeleton, EmptyState and AdvancedTable.
- Every icon-only button has an `aria-label`. Form controls always have a linked `<label>`.
- Errors are shown inline with `role="alert"`. Toasts (sonner) are for confirmations only.
- Loading states use skeletons (`app/(admin)/loading.tsx`), never blank screens.
- **No dead controls**: a button or link ships only when its feature works. The DropX search bar and notification bell were removed until Phases 7 and 8.
- Motion is limited to `animate-fade-in*`, 150–350 ms, and respects `prefers-reduced-motion`.

## Template attribution (licence)
Both footers say **"Designed by Kranas Tech"** (owner's decision, OPEN_QUESTIONS #7a, which replaced the DataDropX credit).

**Storefront look (from 2026-11-11, #6a).** Bookly-style layout and motions in our palette and fonts. Reuse the shared pieces rather than inventing new ones:
- `btn-pill` / `btn-pill-dark` / `btn-pill-light`: crimson pills that turn black on hover.
- `components/carousel.tsx`: 500 ms slides, round side arrows; 2 / 3 / 4 / 5 cards per view.
- `components/reveal.tsx`: sections lift in once on scroll.
- `.card-actions`: product card buttons rise on hover; always visible on touch screens.
- `components/search-overlay.tsx`, `components/preloader.tsx` (first page of a session only), `animate-rise` for dropdowns.

All motion respects `prefers-reduced-motion`. Never add made-up countdowns: the offer countdown only shows for a promo banner with a real `ends_at`.
