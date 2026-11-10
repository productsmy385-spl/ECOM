import { db } from "@ecom/db";
import { sql } from "drizzle-orm";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.WEB_URL ?? "http://localhost:3000";
  const res = (await db.execute(sql`
    select 'p' as t, p.slug, p.updated_at from products p
      join categories c on c.id = p.category_id and c.is_active and c.deleted_at is null
     where p.status = 'published' and p.deleted_at is null
    union all
    select 'c', slug, updated_at from categories where is_active and deleted_at is null`)) as unknown as {
    rows: { t: string; slug: string; updated_at: string }[];
  };
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/categories`, changeFrequency: "weekly", priority: 0.6 },
    ...res.rows.map((r) => ({
      url: r.t === "p" ? `${base}/products/${r.slug}` : `${base}/shop?category=${r.slug}`,
      lastModified: new Date(r.updated_at),
      changeFrequency: "weekly" as const,
      priority: r.t === "p" ? 0.8 : 0.7,
    })),
  ];
}
