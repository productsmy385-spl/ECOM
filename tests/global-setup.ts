import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

/** Migrate + seed the dedicated test database once per run (never the dev DB). */
export default function setup() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL must be set for tests");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");
  const env = {
    ...process.env,
    DATABASE_URL: url,
    SEED_SUPERADMIN_EMAIL: "root@test.local",
    SEED_SUPERADMIN_PASSWORD: "RootPassword#123",
    SEED_SUPERADMIN_NAME: "Root Admin",
  };
  const run = (script: string) =>
    execSync(`pnpm --filter @ecom/db ${script}`, { env, stdio: "pipe" }).toString();
  run("migrate");
  run("seed");
}
