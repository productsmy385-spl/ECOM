/**
 * Public (storefront) catalogue reads. No actor: everything here is visible to
 * anonymous shoppers, so every query is restricted to published products in
 * active categories, and returns no internal fields (cost, exact stock, notes).
 */
import { banners, brands, categories, db, newsletterSubscribers, systemSettings } from "@ecom/db";
import { newsletterSchema, type ShopQuery, shopQuery } from "@ecom/validation";
import { and, asc, eq, gt, isNull, lte, or, sql, type SQL } from "drizzle-orm";

export const PAGE_SIZE = 24;
const NEW_DAYS = 30;

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  brandName: string | null;
  categoryName: string;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  ratingAvg: number;
  ratingCount: number;
  inStock: boolean;
  isCustomizable: boolean;
  isNew: boolean;
  colors: string[];
}

type Row = Record<string, unknown>;
const rowsOf = async (q: SQL): Promise<Row[]> => ((await db.execute(q)) as unknown as { rows: Row[] }).rows;
const list = (values: readonly (string | number)[]) => sql`(${sql.join(values.map((v) => sql`${v}`), sql`, `)})`;

/** Per-product aggregates over active variants (price, MRP of cheapest, stock, colours). */
const VARIANT_AGG = sql`
  select pv.product_id,
         min(pv.price)::int as min_price,
         (array_agg(pv.compare_at_price order by pv.price asc, pv.sort_order asc))[1] as compare_at,
         bool_or(coalesce(i.on_hand - i.reserved, 0) > 0) as in_stock,
         coalesce(array_agg(distinct pv.color_hex) filter (where pv.color_hex is not null), '{}') as colors
    from product_variants pv
    left join inventory i on i.variant_id = pv.id
   where pv.is_active and pv.deleted_at is null
   group by pv.product_id`;

const CARD_SELECT = sql`
  p.id, p.slug, p.name, b.name as brand_name, c.name as category_name,
  p.rating_avg, p.rating_count, p.sold_count, p.published_at, p.is_customizable,
  v.min_price, v.compare_at, v.in_stock, v.colors,
  (select url from product_images pi where pi.product_id = p.id order by pi.sort_order limit 1) as image_url`;

const BASE_FROM = sql`
  from products p
  join (${VARIANT_AGG}) v on v.product_id = p.id
  join categories c on c.id = p.category_id and c.is_active and c.deleted_at is null
  left join brands b on b.id = p.brand_id and b.deleted_at is null
 where p.status = 'published' and p.deleted_at is null`;

function toCard(r: Row): ProductCard {
  const publishedAt = r.published_at ? new Date(r.published_at as string) : null;
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    brandName: (r.brand_name as string) ?? null,
    categoryName: r.category_name as string,
    imageUrl: (r.image_url as string) ?? null,
    price: Number(r.min_price),
    compareAtPrice: r.compare_at === null || r.compare_at === undefined ? null : Number(r.compare_at),
    ratingAvg: Number(r.rating_avg ?? 0),
    ratingCount: Number(r.rating_count ?? 0),
    inStock: Boolean(r.in_stock),
    isCustomizable: Boolean(r.is_customizable),
    isNew: !!publishedAt && Date.now() - publishedAt.getTime() < NEW_DAYS * 86_400_000,
    colors: ((r.colors as string[]) ?? []).slice(0, 5),
  };
}

function categoryCondition(slugValue: string): SQL {
  // A category matches its own products and those of its direct sub-categories.
  return sql`(c.slug = ${slugValue} or c.parent_id = (select id from categories where slug = ${slugValue} and deleted_at is null))`;
}

function filtersFor(q: ShopQuery): SQL[] {
  const f: SQL[] = [];
  if (q.category) f.push(categoryCondition(q.category));
  if (q.brand.length) f.push(sql`b.slug in ${list(q.brand)}`);
  const variantHas = (col: string, values: string[]) =>
    sql`exists (select 1 from product_variants x where x.product_id = p.id and x.is_active and x.deleted_at is null and lower(${sql.raw(`x.${col}`)}) in ${list(values.map((v) => v.toLowerCase()))})`;
  if (q.color.length) f.push(variantHas("color", q.color));
  if (q.size.length) f.push(variantHas("size", q.size));
  if (q.material.length) f.push(variantHas("material", q.material));
  // Price filters arrive in rupees from the URL; stored in paise.
  if (q.minPrice !== undefined) f.push(sql`v.min_price >= ${q.minPrice * 100}`);
  if (q.maxPrice !== undefined) f.push(sql`v.min_price <= ${q.maxPrice * 100}`);
  if (q.rating) f.push(sql`p.rating_avg >= ${q.rating}`);
  if (q.inStock) f.push(sql`v.in_stock`);
  if (q.tag === "new") f.push(sql`p.published_at >= now() - make_interval(days => ${NEW_DAYS})`);
  if (q.tag === "bestseller") f.push(sql`p.sold_count > 0`);
  if (q.tag === "custom") f.push(sql`p.is_customizable`);
  if (q.q) {
    const like = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    f.push(sql`(
      p.search_vector @@ websearch_to_tsquery('simple', ${q.q})
      or ${q.q} <% p.name
      or p.name ilike ${like}
      or b.name ilike ${like}
      or c.name ilike ${like}
      or exists (select 1 from product_variants x where x.product_id = p.id and x.deleted_at is null
                 and (x.color ilike ${like} or x.material ilike ${like} or x.sku ilike ${like}))
      or exists (select 1 from product_attributes a where a.product_id = p.id and a.value ilike ${like})
    )`);
  }
  return f;
}

function orderFor(q: ShopQuery): SQL {
  const sort = q.sort ?? (q.q ? "relevance" : "popular");
  switch (sort) {
    case "relevance":
      return q.q
        ? sql`(ts_rank(p.search_vector, websearch_to_tsquery('simple', ${q.q})) + word_similarity(${q.q}, p.name)) desc, p.sold_count desc`
        : sql`p.sold_count desc, p.rating_count desc, p.published_at desc`;
    case "newest":
      return sql`p.published_at desc nulls last`;
    case "price_asc":
      return sql`v.min_price asc, p.sold_count desc`;
    case "price_desc":
      return sql`v.min_price desc, p.sold_count desc`;
    case "rating":
      return sql`p.rating_avg desc, p.rating_count desc`;
    default:
      return sql`p.sold_count desc, p.rating_count desc, p.published_at desc`;
  }
}

export interface ShopFacets {
  brands: { slug: string; name: string }[];
  colors: { name: string; hex: string | null }[];
  sizes: string[];
  materials: string[];
  priceRange: { min: number; max: number } | null;
}

export interface ShopResult {
  items: ProductCard[];
  total: number;
  page: number;
  totalPages: number;
  query: ShopQuery;
  facets: ShopFacets;
  category: { name: string; slug: string; description: string | null } | null;
}

/** Facet values within the current category/search scope (not narrowed by other filters). */
async function facetsFor(q: ShopQuery): Promise<ShopFacets> {
  const scope = filtersFor({ ...q, brand: [], color: [], size: [], material: [], minPrice: undefined, maxPrice: undefined, rating: undefined, inStock: undefined, tag: undefined });
  const where = scope.length ? sql` and ${sql.join(scope, sql` and `)}` : sql``;
  const scoped = sql`select p.id ${BASE_FROM}${where}`;
  const [brandRows, variantRows, priceRows] = await Promise.all([
    rowsOf(sql`select distinct b.slug, b.name ${BASE_FROM}${where} and b.slug is not null order by b.name`),
    rowsOf(sql`select distinct x.color, x.color_hex, x.size, x.material from product_variants x
               where x.is_active and x.deleted_at is null and x.product_id in (${scoped})`),
    rowsOf(sql`select min(v.min_price)::int as min, max(v.min_price)::int as max ${BASE_FROM}${where}`),
  ]);
  const colors = new Map<string, string | null>();
  const sizes = new Set<string>();
  const materials = new Set<string>();
  for (const r of variantRows) {
    if (r.color) colors.set(String(r.color), (r.color_hex as string) ?? colors.get(String(r.color)) ?? null);
    if (r.size) sizes.add(String(r.size));
    if (r.material) materials.add(String(r.material));
  }
  const pr = priceRows[0];
  return {
    brands: brandRows.map((b) => ({ slug: String(b.slug), name: String(b.name) })),
    colors: [...colors].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name)),
    sizes: [...sizes].sort(),
    materials: [...materials].sort(),
    priceRange: pr && pr.min !== null ? { min: Number(pr.min), max: Number(pr.max) } : null,
  };
}

export async function searchCatalog(raw: unknown): Promise<ShopResult> {
  const q = shopQuery.parse(raw);
  const f = filtersFor(q);
  const where = f.length ? sql` and ${sql.join(f, sql` and `)}` : sql``;
  const offset = (q.page - 1) * PAGE_SIZE;

  const [rows, facets, categoryRow] = await Promise.all([
    rowsOf(sql`select ${CARD_SELECT}, count(*) over() as total ${BASE_FROM}${where} order by ${orderFor(q)} limit ${PAGE_SIZE} offset ${offset}`),
    facetsFor(q),
    q.category
      ? db
          .select({ name: categories.name, slug: categories.slug, description: categories.description })
          .from(categories)
          .where(and(eq(categories.slug, q.category), eq(categories.isActive, true), isNull(categories.deletedAt)))
          .limit(1)
      : Promise.resolve([]),
  ]);
  const total = rows.length ? Number(rows[0]!.total) : 0;
  return {
    items: rows.map(toCard),
    total,
    page: q.page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    query: q,
    facets,
    category: categoryRow[0] ?? null,
  };
}

async function rail(order: SQL, extra: SQL = sql``, limit = 10): Promise<ProductCard[]> {
  const rows = await rowsOf(sql`select ${CARD_SELECT} ${BASE_FROM} ${extra} order by ${order} limit ${limit}`);
  return rows.map(toCard);
}

export interface NavCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  isCustomizable: boolean;
  isFeatured: boolean;
  children: { id: string; name: string; slug: string }[];
}

/** Active categories as a two-level tree, for navigation and the categories page. */
export async function listNavCategories(): Promise<NavCategory[]> {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      parentId: categories.parentId,
      imageUrl: categories.imageUrl,
      isCustomizable: categories.isCustomizable,
      isFeatured: categories.isFeatured,
    })
    .from(categories)
    .where(and(eq(categories.isActive, true), isNull(categories.deletedAt)))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  const top = rows.filter((r) => !r.parentId || !rows.some((p) => p.id === r.parentId));
  return top.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    imageUrl: t.imageUrl,
    isCustomizable: t.isCustomizable,
    isFeatured: t.isFeatured,
    children: rows.filter((c) => c.parentId === t.id).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
  }));
}

export interface HomeData {
  heroBanners: { id: string; title: string; subtitle: string | null; ctaLabel: string | null; ctaHref: string | null; imageUrl: string | null; mobileImageUrl: string | null }[];
  promoBanners: HomeData["heroBanners"];
  categories: NavCategory[];
  trending: ProductCard[];
  bestSellers: ProductCard[];
  newArrivals: ProductCard[];
  customizable: ProductCard[];
  brands: { slug: string; name: string; logoUrl: string | null }[];
  reviews: { id: string; rating: number; title: string | null; body: string | null; author: string; productName: string; productSlug: string }[];
}

export async function getHomeData(): Promise<HomeData> {
  const now = new Date();
  const activeBanner = (placement: "hero" | "promo") =>
    db
      .select({
        id: banners.id,
        title: banners.title,
        subtitle: banners.subtitle,
        ctaLabel: banners.ctaLabel,
        ctaHref: banners.ctaHref,
        imageUrl: banners.imageUrl,
        mobileImageUrl: banners.mobileImageUrl,
      })
      .from(banners)
      .where(
        and(
          eq(banners.placement, placement),
          eq(banners.isActive, true),
          or(isNull(banners.startsAt), lte(banners.startsAt, now)),
          or(isNull(banners.endsAt), gt(banners.endsAt, now)),
        ),
      )
      .orderBy(asc(banners.sortOrder))
      .limit(placement === "hero" ? 5 : 2);

  const [hero, promo, cats, trending, bestSellers, newArrivals, customizable, brandRows, reviewRows] = await Promise.all([
    activeBanner("hero"),
    activeBanner("promo"),
    listNavCategories(),
    // "Trending": recent sales momentum approximated by sales + rating volume on recently published items.
    rail(sql`(p.sold_count * 2 + p.rating_count) desc, p.published_at desc`),
    rail(sql`p.sold_count desc`, sql`and p.sold_count > 0`),
    rail(sql`p.published_at desc nulls last`),
    rail(sql`p.sold_count desc, p.published_at desc`, sql`and p.is_customizable`),
    db
      .select({ slug: brands.slug, name: brands.name, logoUrl: brands.logoUrl })
      .from(brands)
      .where(and(eq(brands.isActive, true), eq(brands.isFeatured, true), isNull(brands.deletedAt)))
      .orderBy(asc(brands.name))
      .limit(12),
    rowsOf(sql`select r.id, r.rating, r.title, r.body, split_part(u.name, ' ', 1) as author, p.name as product_name, p.slug as product_slug
                 from reviews r
                 join users u on u.id = r.user_id
                 join products p on p.id = r.product_id and p.status = 'published' and p.deleted_at is null
                where r.status = 'approved' and r.rating >= 4 and r.body is not null
                order by r.created_at desc limit 6`),
  ]);

  return {
    heroBanners: hero,
    promoBanners: promo,
    categories: cats,
    trending,
    bestSellers,
    newArrivals,
    customizable,
    brands: brandRows,
    reviews: reviewRows.map((r) => ({
      id: String(r.id),
      rating: Number(r.rating),
      title: (r.title as string) ?? null,
      body: (r.body as string) ?? null,
      author: String(r.author),
      productName: String(r.product_name),
      productSlug: String(r.product_slug),
    })),
  };
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  isCustomizable: boolean;
  ratingAvg: number;
  ratingCount: number;
  taxRateBps: number;
  seoTitle: string | null;
  seoDescription: string | null;
  category: { name: string; slug: string };
  brand: { name: string; slug: string } | null;
  images: { url: string; alt: string | null; variantId: string | null }[];
  variants: {
    id: string;
    sku: string;
    name: string;
    color: string | null;
    colorHex: string | null;
    size: string | null;
    material: string | null;
    price: number;
    compareAtPrice: number | null;
    isDefault: boolean;
    /** Coarse availability only — exact counts are not exposed publicly. */
    availability: "in_stock" | "low_stock" | "out_of_stock";
  }[];
  specs: { group: string | null; name: string; value: string }[];
  reviews: { id: string; rating: number; title: string | null; body: string | null; author: string; createdAt: string; verified: boolean }[];
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  delivery: { standardDays: [number, number]; freeShippingAbove: number };
}

async function setting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, key));
  return (row?.value as T) ?? fallback;
}

export async function getProductBySlug(slugValue: string): Promise<ProductDetail | null> {
  const [p] = await rowsOf(sql`
    select p.id, p.slug, p.name, p.short_description, p.description, p.is_customizable, p.rating_avg, p.rating_count,
           p.tax_rate_bps, p.seo_title, p.seo_description,
           c.name as category_name, c.slug as category_slug, b.name as brand_name, b.slug as brand_slug
      from products p
      join categories c on c.id = p.category_id and c.is_active and c.deleted_at is null
      left join brands b on b.id = p.brand_id and b.deleted_at is null
     where p.slug = ${slugValue} and p.status = 'published' and p.deleted_at is null
     limit 1`);
  if (!p) return null;
  const id = String(p.id);

  const [variantRows, imageRows, specRows, reviewRows, breakdownRows, standardDays, freeAbove] = await Promise.all([
    rowsOf(sql`select pv.id, pv.sku, pv.name, pv.color, pv.color_hex, pv.size, pv.material, pv.price, pv.compare_at_price, pv.is_default,
                      coalesce(i.on_hand - i.reserved, 0) as available, coalesce(i.min_stock, 5) as min_stock
                 from product_variants pv left join inventory i on i.variant_id = pv.id
                where pv.product_id = ${id} and pv.is_active and pv.deleted_at is null
                order by pv.sort_order, pv.created_at`),
    rowsOf(sql`select url, alt, variant_id from product_images where product_id = ${id} order by sort_order`),
    rowsOf(sql`select group_name, name, value from product_attributes where product_id = ${id} order by sort_order`),
    rowsOf(sql`select r.id, r.rating, r.title, r.body, split_part(u.name, ' ', 1) as author, r.created_at, (r.order_item_id is not null) as verified
                 from reviews r join users u on u.id = r.user_id
                where r.product_id = ${id} and r.status = 'approved'
                order by r.created_at desc limit 10`),
    rowsOf(sql`select rating, count(*)::int as n from reviews where product_id = ${id} and status = 'approved' group by rating`),
    setting<[number, number]>("shipping.standard_days", [4, 7]),
    setting<number>("shipping.free_threshold", 99900),
  ]);
  if (variantRows.length === 0) return null;

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const r of breakdownRows) breakdown[Number(r.rating) as 1 | 2 | 3 | 4 | 5] = Number(r.n);

  return {
    id,
    slug: String(p.slug),
    name: String(p.name),
    shortDescription: (p.short_description as string) ?? null,
    description: (p.description as string) ?? null,
    isCustomizable: Boolean(p.is_customizable),
    ratingAvg: Number(p.rating_avg ?? 0),
    ratingCount: Number(p.rating_count ?? 0),
    taxRateBps: Number(p.tax_rate_bps),
    seoTitle: (p.seo_title as string) ?? null,
    seoDescription: (p.seo_description as string) ?? null,
    category: { name: String(p.category_name), slug: String(p.category_slug) },
    brand: p.brand_name ? { name: String(p.brand_name), slug: String(p.brand_slug) } : null,
    images: imageRows.map((i) => ({ url: String(i.url), alt: (i.alt as string) ?? null, variantId: (i.variant_id as string) ?? null })),
    variants: variantRows.map((v) => {
      const available = Number(v.available);
      return {
        id: String(v.id),
        sku: String(v.sku),
        name: String(v.name),
        color: (v.color as string) ?? null,
        colorHex: (v.color_hex as string) ?? null,
        size: (v.size as string) ?? null,
        material: (v.material as string) ?? null,
        price: Number(v.price),
        compareAtPrice: v.compare_at_price === null ? null : Number(v.compare_at_price),
        isDefault: Boolean(v.is_default),
        availability: available <= 0 ? "out_of_stock" : available <= Number(v.min_stock) ? "low_stock" : "in_stock",
      };
    }),
    specs: specRows.map((s) => ({ group: (s.group_name as string) ?? null, name: String(s.name), value: String(s.value) })),
    reviews: reviewRows.map((r) => ({
      id: String(r.id),
      rating: Number(r.rating),
      title: (r.title as string) ?? null,
      body: (r.body as string) ?? null,
      author: String(r.author),
      createdAt: new Date(r.created_at as string).toISOString(),
      verified: Boolean(r.verified),
    })),
    ratingBreakdown: breakdown,
    delivery: { standardDays, freeShippingAbove: freeAbove },
  };
}

export async function relatedProducts(productId: string, categorySlug: string, limit = 8): Promise<ProductCard[]> {
  return rail(sql`p.sold_count desc, p.rating_avg desc`, sql`and c.slug = ${categorySlug} and p.id <> ${productId}`, limit);
}

export interface Suggestions {
  products: { slug: string; name: string; imageUrl: string | null; price: number }[];
  categories: { slug: string; name: string }[];
  brands: { slug: string; name: string }[];
}

/** Type-ahead suggestions for the header search box. */
export async function suggest(raw: string): Promise<Suggestions> {
  const q = raw.trim().slice(0, 60);
  if (q.length < 2) return { products: [], categories: [], brands: [] };
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const [prods, cats, brs] = await Promise.all([
    rowsOf(sql`select p.slug, p.name, v.min_price,
                      (select url from product_images pi where pi.product_id = p.id order by pi.sort_order limit 1) as image_url
                 ${BASE_FROM}
                 and (p.search_vector @@ websearch_to_tsquery('simple', ${q}) or p.name ilike ${like} or ${q} <% p.name)
                order by (p.name ilike ${like}) desc, word_similarity(${q}, p.name) desc, p.sold_count desc
                limit 6`),
    rowsOf(sql`select slug, name from categories where is_active and deleted_at is null and name ilike ${like} order by sort_order limit 4`),
    rowsOf(sql`select slug, name from brands where is_active and deleted_at is null and name ilike ${like} order by name limit 4`),
  ]);
  return {
    products: prods.map((p) => ({ slug: String(p.slug), name: String(p.name), imageUrl: (p.image_url as string) ?? null, price: Number(p.min_price) })),
    categories: cats.map((c) => ({ slug: String(c.slug), name: String(c.name) })),
    brands: brs.map((b) => ({ slug: String(b.slug), name: String(b.name) })),
  };
}

/** Newsletter sign-up. Idempotent; re-subscribes a previously unsubscribed address. */
export async function subscribeNewsletter(raw: unknown): Promise<{ ok: true }> {
  const { email } = newsletterSchema.parse(raw);
  // Conflict target is the lower(email) expression index.
  await db.execute(sql`insert into ${newsletterSubscribers} (email) values (${email})
                       on conflict ((lower(email))) do update set unsubscribed_at = null`);
  return { ok: true };
}
