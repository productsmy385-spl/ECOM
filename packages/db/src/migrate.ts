/**
 * Applies pending SQL migrations from ./migrations.
 * Run once per deploy (Railway preDeployCommand), never per app instance.
 * Drizzle wraps the pending set in a transaction and records history in
 * drizzle.__drizzle_migrations. Migrations are additive; this never drops data.
 */
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client";

const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set");
  process.exit(1);
}

// MIGRATIONS_DIR is set in the production image, where this file runs as a bundle.
const migrationsFolder =
  process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL("../migrations", import.meta.url));
const { db, pool } = createDb(url, 1);

const started = Date.now();
try {
  // Advisory lock: if two deploys overlap, the second waits instead of racing.
  await pool.query("select pg_advisory_lock(727274)");
  await migrate(db, { migrationsFolder });
  console.log(`[migrate] up to date (${Date.now() - started} ms)`);
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exitCode = 1;
} finally {
  await pool.query("select pg_advisory_unlock(727274)").catch(() => {});
  await pool.end();
}
