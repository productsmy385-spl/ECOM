import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk only establishes the session here. Access decisions (staff role,
// permissions, suspension) are made per page and per API route from our
// database: see lib/session.ts and lib/api.ts.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next internals and static files...
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // ...and always API routes.
    "/(api|trpc)(.*)",
  ],
};
