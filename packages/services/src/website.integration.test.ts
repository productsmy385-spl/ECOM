/**
 * Website settings and banners: defaults, validation, permissions, audit, and
 * that the validation's template list matches the UI's template catalogue.
 */
import { loadActor } from "@ecom/auth";
import { auditLogs, banners, db, roles, systemSettings, userRoles, users } from "@ecom/db";
import { type Actor, AuthorizationError } from "@ecom/rbac";
import { WEBSITE_TEMPLATES, templateCssVars } from "../../ui/src/website-templates";
import { HOME_SECTION_KEYS, WEBSITE_TEMPLATE_KEYS } from "@ecom/validation";
import { and, eq, like } from "drizzle-orm";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBanner, deleteBanner, DEFAULT_WEBSITE_SETTINGS, getWebsiteSettings, listBanners, updateBanner, updateWebsiteSettings } from "./index";

const run = `ws${Date.now().toString(36)}`;
const ctxOf = async (id: string) => ({ actor: (await loadActor(id)) as Actor });
let root: string, manager: string;
let before: unknown;

beforeAll(async () => {
  const [r] = await db.select({ id: users.id }).from(users).where(eq(users.email, "root@test.local"));
  root = r!.id;
  const [u] = await db.insert(users).values({ name: "Mgr", email: `mgr.${run}@example.test`, isStaff: true }).returning();
  const [role] = await db.select().from(roles).where(eq(roles.key, "manager"));
  await db.insert(userRoles).values({ userId: u!.id, roleId: role!.id });
  manager = u!.id;
  [before] = await db.select().from(systemSettings).where(eq(systemSettings.key, "website.settings"));
});

afterAll(async () => {
  if (before) await db.update(systemSettings).set({ value: (before as { value: unknown }).value }).where(eq(systemSettings.key, "website.settings"));
  else await db.delete(systemSettings).where(eq(systemSettings.key, "website.settings"));
  await db.delete(banners).where(like(banners.title, `% ${run}`));
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
});

describe("templates", () => {
  it("validation and UI list the same templates", () => {
    expect(WEBSITE_TEMPLATES.map((t) => t.key)).toEqual([...WEBSITE_TEMPLATE_KEYS]);
  });
  it("css vars come from the vetted palette", () => {
    const v = templateCssVars("midnight-gold", "square", "playfair");
    expect(v["--primary"]).toBe("#1f2a44");
    expect(v["--radius-pill"]).toBe("0.25rem");
    expect(v["--font-heading"]).toContain("playfair");
    expect(templateCssVars("nope", "rounded", "sora")["--primary"]).toBe("#cf0f47");
  });
});

describe("website settings", () => {
  it("defaults list every home section, enabled", () => {
    expect(DEFAULT_WEBSITE_SETTINGS.template).toBe("adira-crimson");
    expect(DEFAULT_WEBSITE_SETTINGS.sections.map((s) => s.key)).toEqual([...HOME_SECTION_KEYS]);
  });

  it("saves, normalises sections and audits; managers without settings.manage are refused", async () => {
    const ctx = await ctxOf(root);
    const saved = await updateWebsiteSettings(ctx, {
      template: "emerald",
      heroStyle: "banner",
      sections: [{ key: "reviews", enabled: true }, { key: "brands", enabled: false }],
      announcement: { enabled: true, text: "Free gift wrap", href: "/shop" },
      social: { instagram: "https://instagram.com/adira" },
    });
    expect(saved.sections.slice(0, 2)).toEqual([{ key: "reviews", enabled: true }, { key: "brands", enabled: false }]);
    expect(saved.sections).toHaveLength(HOME_SECTION_KEYS.length);
    expect((await getWebsiteSettings()).template).toBe("emerald");
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "settings.website.update"), eq(auditLogs.actorId, root)));
    expect(logs.length).toBeGreaterThan(0);

    await expect(updateWebsiteSettings(await ctxOf(manager), {})).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("rejects unsafe links, unknown templates and an empty announcement", async () => {
    const ctx = await ctxOf(root);
    await expect(updateWebsiteSettings(ctx, { social: { instagram: "javascript:alert(1)" } })).rejects.toBeInstanceOf(ZodError);
    await expect(updateWebsiteSettings(ctx, { announcement: { enabled: true, text: "x", href: "//evil.example" } })).rejects.toBeInstanceOf(ZodError);
    await expect(updateWebsiteSettings(ctx, { template: "hacker" })).rejects.toBeInstanceOf(ZodError);
    await expect(updateWebsiteSettings(ctx, { announcement: { enabled: true, text: "" } })).rejects.toBeInstanceOf(ZodError);
  });

  it("a malformed stored document falls back to defaults", async () => {
    await db.update(systemSettings).set({ value: { template: 42 } }).where(eq(systemSettings.key, "website.settings"));
    expect((await getWebsiteSettings()).template).toBe("adira-crimson");
  });
});

describe("banners", () => {
  it("create, schedule, update and delete with marketing.manage only", async () => {
    const ctx = await ctxOf(root);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const b = await createBanner(ctx, { placement: "hero", title: `Diwali ${run}`, ctaLabel: "Shop", ctaHref: "/shop", startsAt: future });
    expect(b.state).toBe("scheduled");
    const u = await updateBanner(ctx, b.id, { placement: "promo", title: `Diwali ${run}`, ctaLabel: "Shop", ctaHref: "/shop", isActive: false });
    expect(u).toMatchObject({ placement: "promo", state: "off" });
    expect((await listBanners(ctx)).some((x) => x.id === b.id)).toBe(true);
    await expect(createBanner(ctx, { placement: "hero", title: `Bad ${run}`, imageUrl: "https://evil.example/x.png" })).rejects.toBeInstanceOf(ZodError);
    await expect(createBanner(ctx, { placement: "hero", title: `Bad ${run}`, ctaLabel: "Go" })).rejects.toBeInstanceOf(ZodError);
    await deleteBanner(ctx, b.id);
    expect((await listBanners(ctx)).some((x) => x.id === b.id)).toBe(false);
  });
});
