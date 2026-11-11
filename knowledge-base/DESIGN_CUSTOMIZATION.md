# Design customisation engine

The store's differentiator. Customers personalise products (colours, lenses, prescriptions, engraving, labels, their own artwork) in a live editor. Staff review the exact design before production.

## Building blocks `[fact]`
| Piece | Location | Role |
|---|---|---|
| Design model | `packages/validation/src/customization.ts` | Option config schemas, canvas layer schemas, prescription schema, `evaluateSelections()` (validation + pricing + summary). Shared by browser and server. |
| Renderer | `packages/ui/src/design/renderer.tsx` | `DesignSurface` draws a design from its stored data. The editor, the customer's design page and the admin review all use it, so **staff approve exactly what the customer made**. |
| Services | `packages/services/src/customization.ts` | Option configuration, designs, versions, submit, review, assignment, claim |
| Admin | `/admin/products/[id]/customization`, `/admin/designs` | Options builder (with eyewear and cosmetics presets); review queue and detail |
| Storefront | `/customize/[productId]`, `/designs`, `/designs/[id]` | Editor; My designs; status and feedback page |

## Option types
`select`, `color` (swatches), `multiselect` (with a max), `text` (max length; engraving and names), `number`, `image` (customer upload), `prescription` (SPH/CYL in 0.25 steps, AXIS 0–180, PD, ADD), `canvas` (design surface: size, background colour or mock-up image, **print area**, allowed fonts, text and image toggles, max layers).

- Every option can carry a **price delta** (paise).
- Any option can be **conditional** (`showWhen`: e.g. Prescription only when Lens type = Prescription). Hidden answers are dropped, never charged.
- Option **keys** are stable identifiers inside saved designs. Renaming a key orphans old answers.

## Design data `[fact]`
- **Every save is an immutable `design_versions` row**: `{ options: { [key]: value } }`. Never just a preview image. Canvas layers store normalised positions (0–1 of canvas width and height), font id, size (fraction of height), colour, rotation, and ImageKit URLs for images, so a design reproduces at any resolution.
- **Prices are recomputed on the server** on every save. Client-side prices and unknown keys are discarded.
- Stale edits are refused: an update must name the version it was based on (409 otherwise).
- Text layers are plain text, rendered as escaped SVG text, never HTML. Control characters are stripped.
- Images must be `https://ik.imagekit.io/…` URLs.

## Ownership and privacy `[fact]`
- A design belongs to the **signed-in customer** (verified session) or to an **anonymous visitor**: an httpOnly, SameSite=Lax, 1-year cookie `ecom_design_owner` holding 32 random bytes, created on first save.
- Someone else's design is **indistinguishable from a missing one** (404 for both page and API). This is tested in integration and in the browser.
- `claimGuestDesigns(customerId, token)` moves a visitor's designs to their account on sign-in. Phase 5 calls it.
- Limits: 50 designs per owner, 100 versions per design, write rate limits per IP.

## Lifecycle
```
draft ──submit──► submitted ──assign──► in_review ──approve──► approved (locked)
  ▲                                         │
  └──── edit + resubmit ◄── changes_requested (customer sees the message)
                                            └──reject──► rejected (locked)
```
- Submitting requires every **required** option. Drafts may be incomplete, but every value they contain must be valid.
- Products **without** `requiresDesignReview` go straight to `approved` on submit ("Finish design").
- Approved and rejected designs are locked. **Duplicate** creates a new editable draft.

## Staff review `[fact]`
| Action | Permission | Notes |
|---|---|---|
| See all submitted designs | `designs.view` | Drafts are never visible to staff |
| See only designs assigned to me | `designs.view_assigned` | Others get 404 |
| Assign a designer | `designs.assign` | Only staff with design permissions are eligible. Assigning moves the design to `in_review`. |
| Approve / request changes / reject | `designs.approve` | Changes and rejection need a message (≥ 5 chars), shown to the customer |
| Internal notes | `designs.update` or `designs.approve` | Never shown to customers |

The customer's email is only shown to staff with `customers.view` (data minimisation for designers). Every review action is audited.

## Editor features (storefront)
- **Canvas:** add text, add image, drag to move (constrained to the print area), keyboard nudge (arrow keys, Shift for bigger steps), Delete, Undo/Redo (Ctrl+Z / Ctrl+Shift+Z), Reset, and a print-area guide toggle.
- **Layers:** show/hide, lock, bring forward/back, delete.
- **Text properties:** font (admin-allowed list: Sora, Inter, Playfair Display, Dancing Script, Bebas Neue), size, colour (brand swatches + picker), bold, italic, rotation. Images: size (keeps aspect) and rotation.
- **Live price breakdown, Save, Submit**, unsaved-changes warning, mobile layout.

## Not yet built
- Designer-uploaded revision versions and "customer approves the designer's version" (`awaiting_customer`): Phase 8 designer workspace.
- Notifications to customers and designers: Phase 8.
- Ordering a design (it becomes the cart item): Phase 6.
- Rasterised print-ready export (PNG/PDF at print DPI): Phase 8.
- Images need ImageKit keys. Until they're set, "Add image" explains that uploads aren't available, and text-only designs still work.
