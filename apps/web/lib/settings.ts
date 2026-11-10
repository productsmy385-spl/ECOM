import "server-only";
import { db, systemSettings } from "@ecom/db";
import { inArray } from "drizzle-orm";
import { cache } from "react";

/** Public store settings (seeded defaults; editable by admins in Phase 7). */
export const getStoreSettings = cache(async () => {
  const rows = await db
    .select({ key: systemSettings.key, value: systemSettings.value })
    .from(systemSettings)
    .where(inArray(systemSettings.key, ["shipping.free_threshold", "shipping.standard_days", "shipping.standard_fee"]));
  const get = <T,>(k: string, d: T) => (rows.find((r) => r.key === k)?.value as T) ?? d;
  return {
    freeShippingAbove: get<number>("shipping.free_threshold", 99900),
    standardFee: get<number>("shipping.standard_fee", 4900),
    standardDays: get<[number, number]>("shipping.standard_days", [4, 7]),
  };
});
