import { existsSync } from "node:fs";

// Load the root .env, then point every DB client at the isolated test database.
if (existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL must be set for tests");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.WEB_URL ??= "http://localhost:3000";
process.env.ADMIN_URL ??= "http://localhost:3001";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-1234";
// Tests must never send real email.
process.env.RESEND_API_KEY = "";
