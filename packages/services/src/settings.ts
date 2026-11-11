import { type DbOrTx, db, systemSettings } from "@ecom/db";
import { requirePermission } from "@ecom/rbac";
import { type CheckoutSettings, checkoutSettingsSchema } from "@ecom/validation";
import { inArray, sql } from "drizzle-orm";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";

/** system_settings keys behind each checkout setting (seeded by packages/db/src/seed.ts). */
const KEYS: Record<keyof CheckoutSettings, string> = {
  guestCheckoutEnabled: "checkout.guest_enabled",
  codEnabled: "checkout.cod_enabled",
  codMaxAmount: "checkout.cod_max_amount",
  freeShippingThreshold: "shipping.free_threshold",
  standardFee: "shipping.standard_fee",
  expressFee: "shipping.express_fee",
  standardDays: "shipping.standard_days",
  expressDays: "shipping.express_days",
  paymentHoldMinutes: "inventory.payment_hold_minutes",
};

const DEFAULTS: CheckoutSettings = {
  guestCheckoutEnabled: true,
  codEnabled: false,
  codMaxAmount: 500_000,
  freeShippingThreshold: 99_900,
  standardFee: 4_900,
  expressFee: 14_900,
  standardDays: [4, 7],
  expressDays: [1, 3],
  paymentHoldMinutes: 30,
};

/** Current checkout settings; any missing or malformed key falls back to its default. */
export async function getCheckoutSettings(conn: DbOrTx = db): Promise<CheckoutSettings> {
  const rows = await conn
    .select({ key: systemSettings.key, value: systemSettings.value })
    .from(systemSettings)
    .where(inArray(systemSettings.key, Object.values(KEYS)));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const merged = Object.fromEntries(
    (Object.keys(KEYS) as (keyof CheckoutSettings)[]).map((k) => [k, byKey.has(KEYS[k]) ? byKey.get(KEYS[k]) : DEFAULTS[k]]),
  );
  const parsed = checkoutSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULTS;
}

export async function updateCheckoutSettings(ctx: ServiceContext, raw: unknown): Promise<CheckoutSettings> {
  requirePermission(ctx.actor, "settings.manage");
  const input = checkoutSettingsSchema.parse(raw);
  return db.transaction(async (tx) => {
    const before = await getCheckoutSettings(tx);
    for (const k of Object.keys(KEYS) as (keyof CheckoutSettings)[]) {
      await tx
        .insert(systemSettings)
        .values({ key: KEYS[k], value: input[k], updatedBy: ctx.actor.userId })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: sql`excluded.value`, updatedBy: ctx.actor.userId, updatedAt: new Date() },
        });
    }
    await writeAudit(tx, ctx, { action: "settings.checkout.update", entityType: "settings", before, after: input });
    return input;
  });
}

/** Seller details printed on invoices (store.gstin / store.address settings). */
export async function getStoreProfile(conn: DbOrTx = db) {
  const rows = await conn.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings).where(inArray(systemSettings.key, ["store.gstin", "store.address"]));
  const get = (k: string) => String(rows.find((r) => r.key === k)?.value ?? "").trim();
  return { gstin: get("store.gstin"), address: get("store.address") };
}
