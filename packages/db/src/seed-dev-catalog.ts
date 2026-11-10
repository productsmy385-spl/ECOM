/**
 * DEVELOPMENT-ONLY demo catalogue, for building and testing the storefront.
 *   pnpm --filter @ecom/db seed:dev-catalog            # add (idempotent)
 *   pnpm --filter @ecom/db seed:dev-catalog --remove   # remove everything it added
 *
 * Safety: refuses NODE_ENV=production, and any non-local database unless
 * ALLOW_DEV_SEED=1. Brands are fictional; every SKU starts with "DEV-";
 * no images are used (no licensed photography exists yet).
 */
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { createDb } from "./client";
import {
  brands,
  categories,
  inventory,
  inventoryMovements,
  productAttributes,
  products,
  productVariants,
  reviews,
  users,
} from "./schema";

const url = process.env.DATABASE_URL ?? "";
const local = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url);
if (process.env.NODE_ENV === "production" || (!local && process.env.ALLOW_DEV_SEED !== "1")) {
  console.error("[seed:dev-catalog] refused: development databases only (set ALLOW_DEV_SEED=1 to override for staging).");
  process.exit(1);
}
const { db, pool } = createDb(url, 2);

type V = { sku: string; name: string; price: number; mrp?: number; color?: string; hex?: string; size?: string; material?: string; stock: number };
type P = {
  name: string;
  category: string;
  brand: string;
  short: string;
  description: string;
  custom?: boolean;
  tax: number;
  sold: number;
  daysAgo: number;
  specs: [string, string][];
  variants: V[];
};

const BRANDS = [
  { name: "Vela Optics", slug: "dev-vela-optics" },
  { name: "Rosa Beauty", slug: "dev-rosa-beauty" },
  { name: "Atelier Nine", slug: "dev-atelier-nine" },
];

const P: P[] = [
  {
    name: "Aviator Classic Metal Sunglasses", category: "sunglasses", brand: "dev-vela-optics", tax: 1200, sold: 140, daysAgo: 40,
    short: "Lightweight metal aviators with UV400 lenses", description: "A timeless teardrop silhouette in a featherweight metal frame.\nAdjustable nose pads and spring hinges for all-day comfort.",
    specs: [["Lens width", "58 mm"], ["Bridge", "14 mm"], ["UV protection", "UV400"]],
    variants: [
      { sku: "AVI-GLD-M", name: "Gold / Green", price: 249900, mrp: 349900, color: "Gold", hex: "#C9A227", size: "M", material: "Metal", stock: 25 },
      { sku: "AVI-SLV-M", name: "Silver / Grey", price: 249900, mrp: 349900, color: "Silver", hex: "#BFC1C2", size: "M", material: "Metal", stock: 4 },
      { sku: "AVI-BLK-L", name: "Black / Grey", price: 269900, mrp: 349900, color: "Black", hex: "#111111", size: "L", material: "Metal", stock: 0 },
    ],
  },
  {
    name: "Round Wire Eyeglass Frame", category: "eyeglass-frames", brand: "dev-vela-optics", tax: 1200, sold: 95, daysAgo: 12, custom: true,
    short: "Minimal round frame, ready for your prescription", description: "Thin stainless-steel rims with acetate temple tips. Add prescription lenses during checkout.",
    specs: [["Lens width", "49 mm"], ["Frame material", "Stainless steel"], ["Weight", "14 g"]],
    variants: [
      { sku: "RND-GLD-S", name: "Gold S", price: 189900, mrp: 229900, color: "Gold", hex: "#C9A227", size: "S", material: "Steel", stock: 18 },
      { sku: "RND-BLK-M", name: "Black M", price: 189900, color: "Black", hex: "#111111", size: "M", material: "Steel", stock: 30 },
    ],
  },
  {
    name: "Bold Cat-Eye Acetate Frame", category: "designer-frames", brand: "dev-atelier-nine", tax: 1200, sold: 60, daysAgo: 5, custom: true,
    short: "Statement cat-eye in hand-polished acetate", description: "Hand-polished Italian-style acetate with a dramatic upswept brow line.",
    specs: [["Lens width", "52 mm"], ["Frame material", "Acetate"]],
    variants: [
      { sku: "CAT-RED-M", name: "Crimson", price: 459900, mrp: 599900, color: "Red", hex: "#CF0F47", size: "M", material: "Acetate", stock: 8 },
      { sku: "CAT-TOR-M", name: "Tortoise", price: 459900, color: "Tortoise", hex: "#6B3E26", size: "M", material: "Acetate", stock: 12 },
    ],
  },
  {
    name: "Titanium Rimless Premium Frame", category: "premium-frames", brand: "dev-atelier-nine", tax: 1200, sold: 22, daysAgo: 70,
    short: "Ultra-light titanium, barely-there rimless design", description: "Aerospace-grade titanium weighing under 10 g.",
    specs: [["Weight", "9 g"], ["Frame material", "Titanium"]],
    variants: [{ sku: "TIT-SLV-M", name: "Silver", price: 899900, mrp: 1099900, color: "Silver", hex: "#BFC1C2", size: "M", material: "Titanium", stock: 6 }],
  },
  {
    name: "Wayfarer Polarised Sunglasses", category: "sunglasses", brand: "dev-vela-optics", tax: 1200, sold: 210, daysAgo: 100,
    short: "Polarised lenses cut glare on road and water", description: "A classic shape with polarised, scratch-resistant lenses.",
    specs: [["Polarised", "Yes"], ["UV protection", "UV400"]],
    variants: [
      { sku: "WAY-BLK-M", name: "Black", price: 179900, mrp: 249900, color: "Black", hex: "#111111", size: "M", material: "Acetate", stock: 40 },
      { sku: "WAY-BLU-M", name: "Navy", price: 179900, mrp: 249900, color: "Blue", hex: "#1D3A8A", size: "M", material: "Acetate", stock: 15 },
    ],
  },
  {
    name: "Velvet Matte Lipstick", category: "cosmetics", brand: "dev-rosa-beauty", tax: 1800, sold: 320, daysAgo: 30,
    short: "Long-wear matte colour that stays comfortable", description: "A creamy matte formula enriched with vitamin E. Up to 8 hours of wear.",
    specs: [["Net weight", "4.2 g"], ["Finish", "Matte"]],
    variants: [
      { sku: "LIP-CRM", name: "Crimson Kiss", price: 59900, mrp: 79900, color: "Crimson", hex: "#CF0F47", stock: 120 },
      { sku: "LIP-PNK", name: "Hot Pink", price: 59900, mrp: 79900, color: "Pink", hex: "#FF0B55", stock: 80 },
      { sku: "LIP-NUD", name: "Nude Rose", price: 59900, color: "Nude", hex: "#C99A8B", stock: 3 },
    ],
  },
  {
    name: "Hydrating Lip Gloss", category: "cosmetics", brand: "dev-rosa-beauty", tax: 1800, sold: 140, daysAgo: 8,
    short: "Glass-shine gloss with hyaluronic acid", description: "Non-sticky shine that hydrates for hours.",
    specs: [["Volume", "6 ml"]],
    variants: [
      { sku: "GLS-CLR", name: "Clear", price: 44900, color: "Clear", hex: "#F5F5F5", stock: 60 },
      { sku: "GLS-BLS", name: "Blush", price: 44900, color: "Pink", hex: "#FFDEDE", stock: 45 },
    ],
  },
  {
    name: "Personalised Lipstick with Engraved Case", category: "customized-cosmetics", brand: "dev-rosa-beauty", tax: 1800, sold: 75, daysAgo: 3, custom: true,
    short: "Choose your shade and engrave a name on the case", description: "Pick from 12 shades and engrave up to 12 characters on the metal case. Gift box included.",
    specs: [["Engraving", "Up to 12 characters"], ["Gift box", "Included"]],
    variants: [{ sku: "PLIP-STD", name: "Standard case", price: 129900, mrp: 159900, color: "Gold", hex: "#C9A227", stock: 50 }],
  },
  {
    name: "Custom Label Perfume Mist", category: "customized-cosmetics", brand: "dev-rosa-beauty", tax: 1800, sold: 35, daysAgo: 15, custom: true,
    short: "Your name on the bottle, your choice of fragrance", description: "Choose a fragrance family and design a personalised label.",
    specs: [["Volume", "100 ml"]],
    variants: [
      { sku: "MIST-FLR", name: "Floral", price: 149900, size: "100 ml", stock: 30 },
      { sku: "MIST-CIT", name: "Citrus", price: 149900, size: "100 ml", stock: 30 },
    ],
  },
  {
    name: "Leather Glasses Case", category: "accessories", brand: "dev-atelier-nine", tax: 1800, sold: 88, daysAgo: 45,
    short: "Hard-shell case wrapped in soft vegan leather", description: "Protects frames from knocks; magnetic closure.",
    specs: [["Material", "Vegan leather"]],
    variants: [
      { sku: "CASE-BLK", name: "Black", price: 79900, color: "Black", hex: "#111111", material: "Vegan leather", stock: 70 },
      { sku: "CASE-RED", name: "Crimson", price: 79900, color: "Red", hex: "#CF0F47", material: "Vegan leather", stock: 20 },
    ],
  },
  {
    name: "Microfibre Lens Cloth (Pack of 3)", category: "accessories", brand: "dev-vela-optics", tax: 1800, sold: 400, daysAgo: 120,
    short: "Streak-free cleaning for lenses and screens", description: "Ultra-fine microfibre, machine washable.",
    specs: [["Pack", "3 cloths"]],
    variants: [{ sku: "CLOTH-3", name: "Pack of 3", price: 19900, mrp: 29900, stock: 300 }],
  },
  {
    name: "Monogram Eyewear Chain", category: "customized-accessories", brand: "dev-atelier-nine", tax: 1800, sold: 18, daysAgo: 2, custom: true,
    short: "Beaded chain with your initials", description: "Choose bead colours and add up to 3 initials.",
    specs: [["Length", "70 cm"]],
    variants: [
      { sku: "CHAIN-GLD", name: "Gold beads", price: 99900, color: "Gold", hex: "#C9A227", stock: 25 },
      { sku: "CHAIN-PRL", name: "Pearl beads", price: 109900, color: "Pearl", hex: "#F3EFE6", stock: 0 },
    ],
  },
];

const REVIEWS: [string, number, string, string][] = [
  ["Velvet Matte Lipstick", 5, "Stays on all day", "Wore it through a wedding and it barely faded. The crimson shade is gorgeous."],
  ["Aviator Classic Metal Sunglasses", 4, "Light and comfortable", "Feels premium for the price. Lenses are clear and the fit is good."],
  ["Round Wire Eyeglass Frame", 5, "Exactly what I wanted", "Minimal, light, and looks great with my prescription."],
  ["Personalised Lipstick with Engraved Case", 5, "Perfect gift", "Engraving was neat and the box looked lovely."],
];

async function remove() {
  const devProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.id, db.select({ id: productVariants.productId }).from(productVariants).where(like(productVariants.sku, "DEV-%"))));
  const ids = devProducts.map((p) => p.id);
  if (ids.length) {
    const vs = await db.select({ id: productVariants.id }).from(productVariants).where(inArray(productVariants.productId, ids));
    if (vs.length) await db.delete(inventoryMovements).where(inArray(inventoryMovements.variantId, vs.map((v) => v.id)));
    await db.delete(products).where(inArray(products.id, ids));
  }
  await db.delete(brands).where(like(brands.slug, "dev-%"));
  await db.delete(users).where(like(users.email, "dev-reviewer-%@example.test"));
  console.log(`[seed:dev-catalog] removed ${ids.length} products`);
}

async function add() {
  const cats = new Map((await db.select({ id: categories.id, slug: categories.slug }).from(categories)).map((c) => [c.slug, c.id]));
  for (const b of BRANDS) await db.insert(brands).values({ ...b, isFeatured: true }).onConflictDoNothing({ target: brands.slug });
  const brandIds = new Map((await db.select({ id: brands.id, slug: brands.slug }).from(brands).where(like(brands.slug, "dev-%"))).map((b) => [b.slug, b.id]));

  let created = 0;
  for (const p of P) {
    const slug = `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const [exists] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug));
    if (exists) continue;
    const categoryId = cats.get(p.category);
    if (!categoryId) throw new Error(`Category ${p.category} missing. Run the base seed first.`);
    await db.transaction(async (tx) => {
      const published = new Date(Date.now() - p.daysAgo * 86_400_000);
      const [row] = await tx
        .insert(products)
        .values({
          name: p.name,
          slug,
          categoryId,
          brandId: brandIds.get(p.brand) ?? null,
          shortDescription: p.short,
          description: p.description,
          isCustomizable: !!p.custom,
          requiresDesignReview: !!p.custom,
          isFeatured: p.sold > 100,
          taxRateBps: p.tax,
          status: "published",
          publishedAt: published,
          soldCount: p.sold,
        })
        .returning({ id: products.id });
      for (const [i, v] of p.variants.entries()) {
        const [vr] = await tx
          .insert(productVariants)
          .values({
            productId: row!.id,
            sku: `DEV-${v.sku}`,
            name: v.name,
            price: v.price,
            compareAtPrice: v.mrp ?? null,
            color: v.color ?? null,
            colorHex: v.hex ?? null,
            size: v.size ?? null,
            material: v.material ?? null,
            isDefault: i === 0,
            sortOrder: i,
          })
          .returning({ id: productVariants.id });
        await tx.insert(inventory).values({ variantId: vr!.id, onHand: v.stock, minStock: 5 });
        if (v.stock) {
          await tx.insert(inventoryMovements).values({ variantId: vr!.id, type: "adjustment", onHandDelta: v.stock, note: "Dev seed", referenceType: "dev-seed" });
        }
      }
      if (p.specs.length) {
        await tx.insert(productAttributes).values(p.specs.map(([name, value], i) => ({ productId: row!.id, name, value, sortOrder: i })));
      }
    });
    created++;
  }

  // Approved demo reviews from fictional reviewers; product rating aggregates recalculated.
  for (const [i, [productName, rating, title, body]] of REVIEWS.entries()) {
    const email = `dev-reviewer-${i + 1}@example.test`;
    const name = ["Ananya Rao", "Kabir Mehta", "Meera Iyer", "Rohan Das"][i]!;
    // Conflict target is the lower(email) expression index (not expressible in Drizzle's typed upsert).
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

  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)::int` })
    .from(productVariants)
    .where(and(like(productVariants.sku, "DEV-%")))) as [{ n: number }];
  console.log(`[seed:dev-catalog] created ${created} products (${n} DEV variants in total)`);
}

(process.argv.includes("--remove") ? remove() : add())
  .catch((err) => {
    console.error("[seed:dev-catalog] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
