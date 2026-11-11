/**
 * DEMO catalogue of custom-design photo frames and resin (glue-art) frames.
 *   pnpm --filter @ecom/db seed:dev-catalog            # add (idempotent)
 *   pnpm --filter @ecom/db seed:dev-catalog --remove   # remove everything it added
 *
 * Safety: refuses NODE_ENV=production and any non-local database unless
 * ALLOW_DEV_SEED=1 is set deliberately. Every SKU starts with "DEV-", brands
 * are fictional, and images are original illustrations in /demo/*.svg (made by
 * scripts/generate-demo-art.mjs). Real products and photos replace them.
 */
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { createDb } from "./client";
import {
  brands,
  carts,
  categories,
  customerDesigns,
  customizationOptions,
  inventory,
  inventoryMovements,
  orderItems,
  orders,
  payments,
  productAttributes,
  productImages,
  products,
  productVariants,
  reviews,
  users,
} from "./schema";

const url = process.env.DATABASE_URL ?? "";
const local = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);
if (process.env.NODE_ENV === "production" || (!local && process.env.ALLOW_DEV_SEED !== "1")) {
  console.error("[seed:dev-catalog] refused: development databases only (set ALLOW_DEV_SEED=1 to override deliberately).");
  process.exit(1);
}
const { db, pool } = createDb(url, 2);

type V = { sku: string; name: string; price: number; mrp?: number; color?: string; hex?: string; size?: string; material?: string; stock: number };
type Opt = { key: string; label: string; type: "select" | "color" | "text" | "canvas"; isRequired?: boolean; helpText?: string; config: Record<string, unknown> };
type P = {
  name: string;
  category: string;
  brand: string;
  short: string;
  description: string;
  images: string[];
  /** Products with options are customised through the design studio. */
  options?: Opt[];
  review?: boolean;
  sold: number;
  daysAgo: number;
  specs: [string, string][];
  variants: V[];
};

const BRANDS = [
  { name: "Frame Theory", slug: "dev-frame-theory" },
  { name: "Resin Atelier", slug: "dev-resin-atelier" },
  { name: "Memory Lane", slug: "dev-memory-lane" },
];

const img = (n: string) => `/demo/${n}.svg`;
const COLOURS = { config: { choices: [
  { value: "black", label: "Black", hex: "#1B1B1B", priceDelta: 0 },
  { value: "white", label: "White", hex: "#F4F1EC", priceDelta: 0 },
  { value: "walnut", label: "Walnut", hex: "#6B4423", priceDelta: 0 },
  { value: "gold", label: "Gold", hex: "#C9A227", priceDelta: 20000 },
] } };
const SIZES = { config: { choices: [
  { value: "5x7", label: "5 × 7 in", priceDelta: 0 },
  { value: "8x10", label: "8 × 10 in", priceDelta: 30000 },
  { value: "a4", label: "A4 (8.3 × 11.7 in)", priceDelta: 50000 },
  { value: "12x18", label: "12 × 18 in", priceDelta: 90000 },
] } };
const PHOTO = (w: number, h: number, extra: Record<string, unknown> = {}) => ({
  key: "photo",
  label: "Your photo",
  type: "canvas" as const,
  isRequired: true,
  helpText: "Upload a photo and add text. Our designers check it before printing.",
  config: { width: w, height: h, background: { color: "#FFFFFF" }, printArea: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 }, allowText: true, allowImages: true, maxLayers: 8, fonts: ["playfair", "dancing", "sora"], priceDelta: 0, ...extra },
});
const NAME = (label = "Name or message", priceDelta = 9900) => ({ key: "name_text", label, type: "text" as const, config: { maxLength: 30, placeholder: "e.g. Riya & Arjun", priceDelta } });

const P: P[] = [
  {
    name: "Classic Wooden Photo Frame", category: "photo-frames", brand: "dev-frame-theory", sold: 220, daysAgo: 60,
    short: "Solid wood frame with a white mat and real glass", description: "A timeless solid-wood frame with a bevel-cut white mat.\nWall hook and table stand included.",
    images: [img("classic-wooden-photo-frame"), img("classic-wooden-photo-frame-2")],
    specs: [["Material", "Solid pine wood"], ["Front", "Real glass"], ["Mounting", "Wall hook + table stand"]],
    variants: [
      { sku: "CLW-WAL-57", name: "Walnut · 5×7 in", price: 49900, mrp: 69900, color: "Walnut", hex: "#6B4423", size: "5×7 in", material: "Wood", stock: 60 },
      { sku: "CLW-WAL-810", name: "Walnut · 8×10 in", price: 69900, mrp: 89900, color: "Walnut", hex: "#6B4423", size: "8×10 in", material: "Wood", stock: 40 },
      { sku: "CLW-BLK-57", name: "Black · 5×7 in", price: 49900, mrp: 69900, color: "Black", hex: "#1B1B1B", size: "5×7 in", material: "Wood", stock: 50 },
      { sku: "CLW-BLK-810", name: "Black · 8×10 in", price: 69900, mrp: 89900, color: "Black", hex: "#1B1B1B", size: "8×10 in", material: "Wood", stock: 3 },
    ],
  },
  {
    name: "Gold Ornate Photo Frame", category: "photo-frames", brand: "dev-frame-theory", sold: 95, daysAgo: 30,
    short: "Vintage-style gold moulding for portraits", description: "Rich gold moulding with fine detailing.\nPerfect for wedding and family portraits.",
    images: [img("gold-ornate-photo-frame")], specs: [["Material", "Polymer moulding"], ["Finish", "Antique gold"]],
    variants: [{ sku: "GLD-810", name: "8×10 in", price: 129900, mrp: 159900, color: "Gold", hex: "#C9A227", size: "8×10 in", stock: 30 }],
  },
  {
    name: "Minimal Black Table-top Frame", category: "table-top-frames", brand: "dev-frame-theory", sold: 180, daysAgo: 12,
    short: "Slim black frame that stands on any desk", description: "A slim matte-black frame with a fold-out stand.",
    images: [img("minimal-black-table-top-frame")], specs: [["Size", "4×6 in"], ["Stand", "Fold-out back stand"]],
    variants: [{ sku: "MBT-46", name: "4×6 in", price: 34900, size: "4×6 in", color: "Black", hex: "#1B1B1B", stock: 120 }],
  },
  {
    name: "Floating Glass Table Frame", category: "table-top-frames", brand: "dev-resin-atelier", sold: 60, daysAgo: 5,
    short: "Double glass panes on a wooden base", description: "Your photo or pressed flowers float between two glass panes on a walnut base.",
    images: [img("floating-glass-table-frame")], specs: [["Size", "5×7 in"], ["Base", "Walnut wood"]],
    variants: [{ sku: "FGT-57", name: "5×7 in", price: 59900, mrp: 79900, size: "5×7 in", stock: 35 }],
  },
  {
    name: "Personalised Photo Frame with Name", category: "custom-photo-frames", brand: "dev-memory-lane", sold: 310, daysAgo: 20, review: true,
    short: "Your photo with names, printed and framed", description: "Upload your favourite photo and add names or a message.\nPrinted on premium photo paper and framed behind glass.",
    images: [img("personalised-photo-frame-with-name")], specs: [["Print", "Premium lustre photo paper"], ["Front", "Real glass"]],
    options: [{ key: "frame_colour", label: "Frame colour", type: "color", isRequired: true, ...COLOURS }, { key: "size", label: "Size", type: "select", isRequired: true, ...SIZES }, PHOTO(800, 1000), NAME()],
    variants: [{ sku: "PPF-STD", name: "Standard", price: 79900, mrp: 99900, stock: 200 }],
  },
  {
    name: "Couple Photo Frame with Date", category: "custom-photo-frames", brand: "dev-memory-lane", sold: 140, daysAgo: 8, review: true,
    short: "Celebrate your day with your photo and date", description: "A bold crimson frame for anniversaries and weddings, with your photo and special date.",
    images: [img("couple-photo-frame-with-date")], specs: [["Orientation", "Landscape"], ["Front", "Real glass"]],
    options: [{ key: "frame_colour", label: "Frame colour", type: "color", isRequired: true, ...COLOURS }, PHOTO(1000, 800), NAME("Names and date")],
    variants: [{ sku: "CPF-STD", name: "8×10 in", price: 89900, size: "8×10 in", stock: 150 }],
  },
  {
    name: "Pressed Flower Resin Frame", category: "resin-art-frames", brand: "dev-resin-atelier", sold: 260, daysAgo: 15, review: true,
    short: "Real pressed flowers set in crystal-clear resin", description: "Handmade with real pressed flowers, gold flakes and glitter set in crystal-clear resin.\nEvery piece is one of a kind.",
    images: [img("pressed-flower-resin-frame"), img("pressed-flower-resin-frame-2")], specs: [["Technique", "Handmade resin (glue-art)"], ["Thickness", "12 mm resin block"], ["Care", "Keep out of direct sunlight"]],
    options: [
      { key: "flowers", label: "Flowers", type: "select", isRequired: true, config: { choices: [{ value: "rose", label: "Rose petals", priceDelta: 0 }, { value: "babys_breath", label: "Baby's breath", priceDelta: 0 }, { value: "lavender", label: "Lavender", priceDelta: 0 }, { value: "wildflowers", label: "Mixed wildflowers", priceDelta: 15000 }] } },
      { key: "finish", label: "Resin finish", type: "select", isRequired: true, config: { choices: [{ value: "clear", label: "Crystal clear", priceDelta: 0 }, { value: "pink", label: "Blush pink tint", priceDelta: 0 }, { value: "ocean", label: "Ocean blue", priceDelta: 0 }, { value: "gold", label: "Gold flakes", priceDelta: 19900 }] } },
      { key: "frame_colour", label: "Frame colour", type: "color", isRequired: true, ...COLOURS },
      NAME("Name to set in resin"),
    ],
    variants: [{ sku: "PFR-810", name: "8×10 in", price: 189900, mrp: 229900, size: "8×10 in", stock: 25 }],
  },
  {
    name: "Glitter Resin Keepsake Frame", category: "resin-art-frames", brand: "dev-resin-atelier", sold: 120, daysAgo: 3,
    short: "Shimmering resin art with your keepsakes", description: "Glitter, flowers and small keepsakes (tickets, petals, notes) preserved in resin.",
    images: [img("glitter-resin-keepsake-frame")], specs: [["Technique", "Handmade resin (glue-art)"], ["Size", "10×10 in"]],
    options: [
      { key: "glitter", label: "Glitter colour", type: "color", isRequired: true, config: { choices: [{ value: "rose_gold", label: "Rose gold", hex: "#E8A3A0", priceDelta: 0 }, { value: "silver", label: "Silver", hex: "#C9CCD1", priceDelta: 0 }, { value: "gold", label: "Gold", hex: "#D4A93A", priceDelta: 0 }] } },
      NAME("Name or date", 0),
    ],
    variants: [{ sku: "GRK-1010", name: "10×10 in", price: 149900, size: "10×10 in", stock: 20 }],
  },
  {
    name: "Baby Footprint Resin Frame", category: "resin-art-frames", brand: "dev-resin-atelier", sold: 75, daysAgo: 2,
    short: "Tiny footprints, name and birth date in resin", description: "Send us your baby's footprint photo; we recreate it in resin with name and birth date.",
    images: [img("baby-footprint-resin-frame")], specs: [["Technique", "Handmade resin (glue-art)"], ["Size", "10×10 in"]],
    options: [PHOTO(1000, 1000, { allowText: false, maxLayers: 2 }), NAME("Baby's name and birth date", 0)],
    variants: [{ sku: "BFR-1010", name: "10×10 in", price: 219900, mrp: 249900, size: "10×10 in", stock: 15 }],
  },
  {
    name: "Four Photo Collage Frame", category: "collage-frames", brand: "dev-memory-lane", sold: 160, daysAgo: 25,
    short: "Four favourite photos in one frame", description: "A 2×2 collage with a crisp white mat. Arrange your photos in the design studio.",
    images: [img("four-photo-collage-frame")], specs: [["Openings", "4 × (5×5 in)"], ["Overall", "12×12 in"]],
    options: [{ key: "frame_colour", label: "Frame colour", type: "color", isRequired: true, ...COLOURS }, PHOTO(1000, 1000, { maxLayers: 10 })],
    variants: [{ sku: "FPC-1212", name: "12×12 in", price: 149900, mrp: 179900, size: "12×12 in", stock: 40 }],
  },
  {
    name: "Family Tree Collage Frame", category: "collage-frames", brand: "dev-memory-lane", sold: 45, daysAgo: 40,
    short: "Family portraits arranged on a tree", description: "Seven round portraits arranged on an illustrated family tree.",
    images: [img("family-tree-collage-frame")], specs: [["Portraits", "7"], ["Overall", "16×14 in"]],
    options: [PHOTO(1000, 900, { maxLayers: 14 })],
    variants: [{ sku: "FTC-1614", name: "16×14 in", price: 249900, size: "16×14 in", stock: 18 }],
  },
  {
    name: "Name Meaning Quote Frame", category: "name-quote-frames", brand: "dev-frame-theory", sold: 130, daysAgo: 18,
    short: "A name and its meaning, beautifully lettered", description: "Elegant lettering of a name with its meaning. A thoughtful gift for any age.",
    images: [img("name-meaning-quote-frame")], specs: [["Print", "Fine-art matte paper"], ["Size", "A4"]],
    options: [{ key: "frame_colour", label: "Frame colour", type: "color", isRequired: true, ...COLOURS }, { ...NAME("Name", 0), isRequired: true }, { key: "meaning", label: "Meaning (optional)", type: "text", config: { maxLength: 40, placeholder: "e.g. Grace · Infinite", priceDelta: 0 } }],
    variants: [{ sku: "NMQ-A4", name: "A4", price: 69900, mrp: 89900, size: "A4", stock: 80 }],
  },
  {
    name: "Gallery Wall Frame Set", category: "wall-frames", brand: "dev-frame-theory", sold: 70, daysAgo: 35,
    short: "Three matching frames for a gallery wall", description: "A set of three black frames (1 portrait + 2 landscape) with a hanging template.",
    images: [img("gallery-wall-frame-set")], specs: [["Pieces", "3"], ["Includes", "Paper hanging template"]],
    variants: [{ sku: "GWS-3", name: "Set of 3", price: 199900, mrp: 249900, color: "Black", hex: "#1B1B1B", stock: 22 }],
  },
  {
    name: "Mother's Day Gift Frame", category: "gift-frames", brand: "dev-memory-lane", sold: 90, daysAgo: 1,
    short: "Photo frame with a message for Maa, gift-wrapped", description: "Your photo with a heartfelt message, gift-wrapped with a card.",
    images: [img("mothers-day-gift-frame")], specs: [["Includes", "Gift wrap + card"]],
    options: [PHOTO(800, 1000), NAME("Message", 0)],
    variants: [{ sku: "MDG-57", name: "5×7 in", price: 99900, size: "5×7 in", stock: 60 }],
  },
];

const CATEGORY_IMAGES = ["photo-frames", "custom-photo-frames", "resin-art-frames", "collage-frames", "name-quote-frames", "wall-frames", "table-top-frames", "gift-frames"];

const REVIEWS: [string, number, string, string][] = [
  ["Pressed Flower Resin Frame", 5, "Absolutely stunning", "The flowers look real and the gold flakes catch the light. Gifted it to my sister and she loved it."],
  ["Personalised Photo Frame with Name", 5, "Print quality is great", "Sharp print, sturdy frame and the names looked lovely. Arrived well packed."],
  ["Couple Photo Frame with Date", 4, "Perfect anniversary gift", "Colour is a bold crimson, exactly as shown. Delivery was a day late but worth it."],
  ["Classic Wooden Photo Frame", 5, "Solid and elegant", "Real wood and glass at this price. Bought three more for the hallway."],
];

async function remove() {
  const devVariants = await db.select({ id: productVariants.id, productId: productVariants.productId }).from(productVariants).where(like(productVariants.sku, "DEV-%"));
  const ids = [...new Set(devVariants.map((v) => v.productId))];
  if (ids.length) {
    const vids = devVariants.map((v) => v.id);
    // Local test orders that used demo items go too (dev databases only).
    const ords = await db.selectDistinct({ id: orderItems.orderId }).from(orderItems).where(inArray(orderItems.variantId, vids));
    if (ords.length) {
      await db.delete(payments).where(inArray(payments.orderId, ords.map((o) => o.id)));
      await db.delete(orders).where(inArray(orders.id, ords.map((o) => o.id)));
    }
    await db.delete(customerDesigns).where(inArray(customerDesigns.productId, ids));
    await db.delete(inventoryMovements).where(inArray(inventoryMovements.variantId, vids));
    await db.delete(products).where(inArray(products.id, ids));
  }
  await db.execute(sql`delete from ${carts} c where not exists (select 1 from cart_items i where i.cart_id = c.id)`);
  await db.update(categories).set({ imageUrl: null }).where(like(categories.imageUrl, "/demo/%"));
  await db.delete(brands).where(like(brands.slug, "dev-%"));
  await db.delete(users).where(like(users.email, "dev-reviewer-%@example.test"));
  console.log(`[seed:dev-catalog] removed ${ids.length} demo products`);
}

async function add() {
  const cats = new Map((await db.select({ id: categories.id, slug: categories.slug }).from(categories)).map((c) => [c.slug, c.id]));
  for (const slug of CATEGORY_IMAGES) {
    await db.update(categories).set({ imageUrl: `/demo/cat-${slug}.svg` }).where(and(eq(categories.slug, slug), sql`${categories.imageUrl} is null`));
  }
  for (const b of BRANDS) await db.insert(brands).values({ ...b, isFeatured: true }).onConflictDoNothing({ target: brands.slug });
  const brandIds = new Map((await db.select({ id: brands.id, slug: brands.slug }).from(brands).where(like(brands.slug, "dev-%"))).map((b) => [b.slug, b.id]));

  let created = 0;
  for (const p of P) {
    const slug = p.name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const [exists] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug));
    if (exists) continue;
    const categoryId = cats.get(p.category);
    if (!categoryId) throw new Error(`Category ${p.category} missing. Run the migrations first.`);
    await db.transaction(async (tx) => {
      const custom = !!p.options?.length;
      const [row] = await tx
        .insert(products)
        .values({
          name: p.name,
          slug,
          categoryId,
          brandId: brandIds.get(p.brand) ?? null,
          shortDescription: p.short,
          description: p.description,
          isCustomizable: custom,
          requiresDesignReview: custom,
          isFeatured: p.sold > 100,
          taxRateBps: 1200,
          status: "published",
          publishedAt: new Date(Date.now() - p.daysAgo * 86_400_000),
          soldCount: p.sold,
        })
        .returning({ id: products.id });
      for (const [i, v] of p.variants.entries()) {
        const [vr] = await tx
          .insert(productVariants)
          .values({ productId: row!.id, sku: `DEV-${v.sku}`, name: v.name, price: v.price, compareAtPrice: v.mrp ?? null, color: v.color ?? null, colorHex: v.hex ?? null, size: v.size ?? null, material: v.material ?? null, isDefault: i === 0, sortOrder: i })
          .returning({ id: productVariants.id });
        await tx.insert(inventory).values({ variantId: vr!.id, onHand: v.stock, minStock: 5 });
        if (v.stock) await tx.insert(inventoryMovements).values({ variantId: vr!.id, type: "adjustment", onHandDelta: v.stock, note: "Demo seed", referenceType: "dev-seed" });
      }
      await tx.insert(productImages).values(p.images.map((url, i) => ({ productId: row!.id, url, alt: p.name, sortOrder: i })));
      if (p.specs.length) await tx.insert(productAttributes).values(p.specs.map(([name, value], i) => ({ productId: row!.id, name, value, sortOrder: i })));
      if (p.options) {
        await tx.insert(customizationOptions).values(
          p.options.map((o, i) => ({ productId: row!.id, key: o.key, label: o.label, helpText: o.helpText ?? null, type: o.type, isRequired: !!o.isRequired, config: o.config, sortOrder: i })),
        );
      }
    });
    created++;
  }

  for (const [i, [productName, rating, title, body]] of REVIEWS.entries()) {
    const email = `dev-reviewer-${i + 1}@example.test`;
    const name = ["Ananya Rao", "Kabir Mehta", "Meera Iyer", "Rohan Das"][i]!;
    const res = (await db.execute(sql`insert into ${users} (name, email) values (${name}, ${email})
        on conflict ((lower(email))) do update set name = excluded.name returning id`)) as unknown as { rows: { id: string }[] };
    const u = res.rows[0];
    const [prod] = await db.select({ id: products.id }).from(products).where(eq(products.name, productName));
    if (!u || !prod) continue;
    await db.insert(reviews).values({ productId: prod.id, userId: u.id, rating, title, body, status: "approved" }).onConflictDoNothing();
  }
  await db.execute(sql`
    update products p set rating_avg = s.avg, rating_count = s.n
      from (select product_id, round(avg(rating)::numeric, 2) as avg, count(*)::int as n from reviews where status = 'approved' group by product_id) s
     where s.product_id = p.id`);
  console.log(`[seed:dev-catalog] created ${created} demo frame products`);
}

(process.argv.includes("--remove") ? remove() : add())
  .catch((err) => {
    console.error("[seed:dev-catalog] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
