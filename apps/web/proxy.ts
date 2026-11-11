import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk only establishes the session here. What a shopper may see or change is
// decided per page and per API route (lib/customer.ts, lib/customer-route.ts),
// so guests can still browse, design and (later) check out.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next internals and static files...
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // ...and always API routes.
    "/(api|trpc)(.*)",
  ],
};
