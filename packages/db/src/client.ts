import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
/** A transaction handle has the same query API as the db. */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Tx;

type Cache = { pool?: pg.Pool; db?: Database };
// Survive Next.js dev hot reloads without leaking pools.
const cache = globalThis as unknown as { __ecomDb?: Cache };
cache.__ecomDb ??= {};

export function createPool(connectionString: string, max?: number): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    max: max ?? Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Railway's public proxy requires TLS; the private network does not.
    ssl: /sslmode=require|proxy\.rlwy\.net/.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });
  // An idle client erroring (e.g. DB restart) must not crash the process.
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  return pool;
}

export function getPool(): pg.Pool {
  if (!cache.__ecomDb!.pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    cache.__ecomDb!.pool = createPool(url);
  }
  return cache.__ecomDb!.pool;
}

export function getDb(): Database {
  cache.__ecomDb!.db ??= drizzle(getPool(), { schema, casing: "snake_case" });
  return cache.__ecomDb!.db;
}

/** Lazily-initialised shared db instance (no connection until first query). */
export const db: Database = new Proxy({} as Database, {
  get(_t, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export function createDb(connectionString: string, max = 5) {
  const pool = createPool(connectionString, max);
  return { db: drizzle(pool, { schema, casing: "snake_case" }), pool };
}

/** Lightweight connectivity check for /api/health. */
export async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    await getPool().query("select 1");
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, error: (err as Error).message };
  }
}
