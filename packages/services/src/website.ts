/**
 * Website settings and homepage banners.
 * - Settings: one JSON document (system_settings["website.settings"]); public
 *   read (the storefront renders from it), `settings.manage` to change.
 * - Banners: hero and offer banners; `marketing.manage` to change.
 */
import { banners, type DbOrTx, db, systemSettings } from "@ecom/db";
import { requirePermission } from "@ecom/rbac";
import { bannerInputSchema, type WebsiteSettings, websiteSettingsSchema } from "@ecom/validation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { NotFoundError } from "./errors";

const KEY = "website.settings";

export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = websiteSettingsSchema.parse({});

/** Current settings; a missing or malformed document falls back to defaults (never throws). */
export async function getWebsiteSettings(conn: DbOrTx = db): Promise<WebsiteSettings> {
  const [row] = await conn.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, KEY));
  if (!row) return DEFAULT_WEBSITE_SETTINGS;
  const parsed = websiteSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_WEBSITE_SETTINGS;
}

export async function updateWebsiteSettings(ctx: ServiceContext, raw: unknown): Promise<WebsiteSettings> {
  requirePermission(ctx.actor, "settings.manage");
  const input = websiteSettingsSchema.parse(raw);
  return db.transaction(async (tx) => {
    const before = await getWebsiteSettings(tx);
    await tx
      .insert(systemSettings)
      .values({ key: KEY, value: input, description: "Storefront template, layout, sections, contact and SEO", updatedBy: ctx.actor.userId })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: sql`excluded.value`, updatedBy: ctx.actor.userId, updatedAt: new Date() } });
    await writeAudit(tx, ctx, { action: "settings.website.update", entityType: "settings", entityId: KEY, before, after: input });
    return input;
  });
}

// ---------------------------------------------------------------- banners

export interface BannerRow {
  id: string;
  placement: "hero" | "promo" | "category";
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  sortOrder: number;
  isActive: boolean;
  /** live = active and within its dates right now. */
  state: "live" | "scheduled" | "ended" | "off";
}

const cols = {
  id: banners.id,
  placement: banners.placement,
  title: banners.title,
  subtitle: banners.subtitle,
  ctaLabel: banners.ctaLabel,
  ctaHref: banners.ctaHref,
  imageUrl: banners.imageUrl,
  mobileImageUrl: banners.mobileImageUrl,
  startsAt: banners.startsAt,
  endsAt: banners.endsAt,
  sortOrder: banners.sortOrder,
  isActive: banners.isActive,
};

function withState(b: Omit<BannerRow, "state">): BannerRow {
  const now = Date.now();
  const state = !b.isActive ? "off" : b.endsAt && b.endsAt.getTime() <= now ? "ended" : b.startsAt && b.startsAt.getTime() > now ? "scheduled" : "live";
  return { ...b, state };
}

export async function listBanners(ctx: ServiceContext): Promise<BannerRow[]> {
  requirePermission(ctx.actor, "marketing.manage");
  const rows = await db.select(cols).from(banners).orderBy(asc(banners.placement), asc(banners.sortOrder), desc(banners.createdAt));
  return rows.map(withState);
}

export async function getBanner(ctx: ServiceContext, id: string): Promise<BannerRow> {
  requirePermission(ctx.actor, "marketing.manage");
  const [b] = await db.select(cols).from(banners).where(eq(banners.id, id));
  if (!b) throw new NotFoundError("Banner not found.");
  return withState(b);
}

function toRow(input: ReturnType<typeof bannerInputSchema.parse>) {
  const blank = (v: string) => (v ? v : null);
  return {
    placement: input.placement,
    title: input.title,
    subtitle: blank(input.subtitle),
    ctaLabel: blank(input.ctaLabel),
    ctaHref: blank(input.ctaHref),
    imageUrl: blank(input.imageUrl),
    mobileImageUrl: blank(input.mobileImageUrl),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  };
}

export async function createBanner(ctx: ServiceContext, raw: unknown): Promise<BannerRow> {
  requirePermission(ctx.actor, "marketing.manage");
  const values = toRow(bannerInputSchema.parse(raw));
  return db.transaction(async (tx) => {
    const [b] = await tx.insert(banners).values(values).returning(cols);
    await writeAudit(tx, ctx, { action: "banner.create", entityType: "banner", entityId: b!.id, after: values });
    return withState(b!);
  });
}

export async function updateBanner(ctx: ServiceContext, id: string, raw: unknown): Promise<BannerRow> {
  requirePermission(ctx.actor, "marketing.manage");
  const values = toRow(bannerInputSchema.parse(raw));
  return db.transaction(async (tx) => {
    const [before] = await tx.select(cols).from(banners).where(eq(banners.id, id)).for("update");
    if (!before) throw new NotFoundError("Banner not found.");
    const [b] = await tx.update(banners).set({ ...values, updatedAt: new Date() }).where(eq(banners.id, id)).returning(cols);
    await writeAudit(tx, ctx, { action: "banner.update", entityType: "banner", entityId: id, before, after: values });
    return withState(b!);
  });
}

export async function deleteBanner(ctx: ServiceContext, id: string): Promise<void> {
  requirePermission(ctx.actor, "marketing.manage");
  await db.transaction(async (tx) => {
    const [before] = await tx.delete(banners).where(eq(banners.id, id)).returning(cols);
    if (!before) throw new NotFoundError("Banner not found.");
    await writeAudit(tx, ctx, { action: "banner.delete", entityType: "banner", entityId: id, before });
  });
}
