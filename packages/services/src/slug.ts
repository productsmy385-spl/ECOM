import type { DbOrTx } from "@ecom/db";
import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "item"
  );
}

/**
 * Returns `base`, or `base-2`, `base-3`… — the first slug not used by any row
 * (including soft-deleted rows, since the unique index covers them).
 */
export async function uniqueSlug(
  conn: DbOrTx,
  table: PgTable,
  base: string,
  exceptId?: string,
): Promise<string> {
  const rows = (await conn.execute(
    sql`select slug from ${table} where (slug = ${base} or slug like ${`${base}-%`}) ${
      exceptId ? sql`and id <> ${exceptId}` : sql``
    }`,
  )) as unknown as { rows: { slug: string }[] };
  const taken = new Set(rows.rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}
