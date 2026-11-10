import { accounts, customerProfiles, db, sessions, users, verifications } from "@ecom/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { hasAnyRole } from "./actor";
import { sendEmail, simpleEmail } from "./email";

export type AppKind = "web" | "admin";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/**
 * One Better Auth configuration, mounted separately by each app:
 *  - web:   customers. Public sign-up, email+password and email OTP.
 *  - admin: staff only. Sign-up disabled (staff are created by Super Admin/Admin),
 *           and a session is refused for any user without a role.
 * Cookies are prefixed per app, so a customer session never authenticates /admin.
 */
export function createAuth(app: AppKind) {
  const baseURL = app === "web" ? required("WEB_URL") : required("ADMIN_URL");
  const isProd = process.env.NODE_ENV === "production";

  return betterAuth({
    appName: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Store",
    baseURL,
    // The admin app runs under Next basePath "/admin".
    basePath: app === "admin" ? "/admin/api/auth" : "/api/auth",
    secret: required("BETTER_AUTH_SECRET"),
    trustedOrigins: [process.env.WEB_URL, process.env.ADMIN_URL].filter(Boolean) as string[],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    user: {
      additionalFields: {
        phone: { type: "string", required: false },
        // Server-controlled: cannot be set through sign-up or update-user input.
        isStaff: { type: "boolean", required: false, defaultValue: false, input: false },
        status: { type: "string", required: false, defaultValue: "active", input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: app === "admin",
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 30,
      sendResetPassword: async ({ user, url }) => {
        const m = simpleEmail(
          "Reset your password",
          "We received a request to reset your password. The link expires in 30 minutes. If you did not ask for this, ignore this email.",
          { label: "Reset password", url },
        );
        await sendEmail({ to: user.email, subject: "Reset your password", ...m });
      },
    },
    session: {
      expiresIn: app === "admin" ? 60 * 60 * 12 : 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 4,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/forget-password": { window: 300, max: 3 },
        "/request-password-reset": { window: 300, max: 3 },
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: app === "admin" ? "ecom_admin" : "ecom",
      useSecureCookies: isProd,
      database: { generateId: "uuid" },
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (app === "web") {
              await db.insert(customerProfiles).values({ userId: user.id }).onConflictDoNothing();
            }
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const [u] = await db
              .select({ status: users.status, deletedAt: users.deletedAt })
              .from(users)
              .where(eq(users.id, session.userId))
              .limit(1);
            if (!u || u.status !== "active" || u.deletedAt) {
              throw new APIError("FORBIDDEN", { message: "This account is not active." });
            }
            if (app === "admin" && !(await hasAnyRole(session.userId))) {
              throw new APIError("FORBIDDEN", { message: "This account does not have staff access." });
            }
          },
          after: async (session) => {
            await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, session.userId));
          },
        },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        disableSignUp: app === "admin",
        sendVerificationOTP: async ({ email, otp, type }) => {
          const purpose =
            type === "sign-in" ? "sign in" : type === "forget-password" ? "reset your password" : "verify your email";
          const m = simpleEmail(`Your code: ${otp}`, `Use this code to ${purpose}. It expires in 5 minutes.`);
          await sendEmail({ to: email, subject: `Your verification code is ${otp}`, ...m });
        },
      }),
      nextCookies(), // must be last
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
