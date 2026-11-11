import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk only establishes the session here. Access decisions (staff role,
// permissions, suspension) are made per page and per API route from our
// database: see lib/session.ts and lib/api.ts.
export default clerkMiddleware();

export const config = {
  matcher: [
    // The basePath root (/admin) must be listed explicitly: the pattern below
    // does not match it, and auth() then throws (production 500 on /admin).
    "/",
    // Everything except Next internals and static files...
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // ...and always API routes.
    "/(api|trpc)(.*)",
  ],
};
