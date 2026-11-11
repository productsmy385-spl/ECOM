/**
 * Security headers shared by both apps (imported by each next.config.ts).
 *
 * The CSP allows only the third parties the apps actually use: Clerk (its
 * Frontend API host is derived from the publishable key, plus Clerk's image CDN
 * and Cloudflare Turnstile for bot protection), Razorpay Checkout, and
 * ImageKit. Next.js inlines bootstrap scripts, so script-src needs
 * 'unsafe-inline'; nonces would force every page to render dynamically. The
 * policy still blocks scripts and connections to any other origin, plugins,
 * <base> hijacking, foreign form posts and framing.
 */
type Header = { key: string; value: string };

/** pk_test_/pk_live_ keys are base64 of "<frontend-api-host>$". */
export function clerkFrontendHost(publishableKey: string | undefined): string | null {
  const m = publishableKey?.match(/^pk_(?:test|live)_(.+)$/);
  if (!m) return null;
  try {
    const host = Buffer.from(m[1]!, "base64").toString("utf8").replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) ? host : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(opts: { app: "web" | "admin"; dev: boolean; clerkHost: string | null }): string {
  // Clerk's Frontend API plus its bot-protection CDN (loaded by the sign-in/up widgets).
  const clerk = [...(opts.clerkHost ? [`https://${opts.clerkHost}`] : []), "https://cdn.protect.clerk.com"];
  const razorpay = opts.app === "web" ? ["https://checkout.razorpay.com"] : [];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(opts.dev ? ["'unsafe-eval'"] : []), ...clerk, "https://challenges.cloudflare.com", ...razorpay],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://img.clerk.com", "https://ik.imagekit.io", ...(opts.app === "web" ? ["https://*.razorpay.com"] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      ...clerk,
      "https://clerk-telemetry.com",
      "https://ik.imagekit.io",
      "https://upload.imagekit.io",
      ...(opts.app === "web" ? ["https://api.razorpay.com", "https://lumberjack.razorpay.com"] : []),
      ...(opts.dev ? ["ws:", "wss:"] : []),
    ],
    "frame-src": ["'self'", ...clerk, "https://challenges.cloudflare.com", ...(opts.app === "web" ? ["https://api.razorpay.com", "https://checkout.razorpay.com"] : [])],
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'self'", "blob:", "https://ik.imagekit.io"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", ...(opts.app === "web" ? ["https://api.razorpay.com"] : [])],
    "frame-ancestors": [opts.app === "admin" ? "'none'" : "'self'"],
  };
  // No upgrade-insecure-requests: HSTS covers production, and the directive breaks local http `next start`.
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

export function securityHeaders(app: "web" | "admin"): Header[] {
  const dev = process.env.NODE_ENV !== "production";
  const csp = contentSecurityPolicy({ app, dev, clerkHost: clerkFrontendHost(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) });
  const headers: Header[] = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: app === "admin" ? "DENY" : "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    {
      key: "Permissions-Policy",
      // Admin: delivery captains share location and photograph proof of delivery.
      value: app === "admin" ? "camera=(self), geolocation=(self), microphone=()" : "camera=(), geolocation=(), microphone=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")",
    },
  ];
  if (!dev) headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  if (app === "admin") headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  return headers;
}
