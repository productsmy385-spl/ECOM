import { ClerkProvider } from "@clerk/nextjs";
import { brand } from "@ecom/ui/brand";
import { clerkAppearance } from "@ecom/ui/clerk-appearance";
import { designFontVariables } from "@ecom/ui/design-fonts";
import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { Suspense } from "react";
import { NavigationLoader } from "@/components/navigation-loader";
import { Preloader } from "@/components/preloader";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WishlistProvider } from "@/components/wishlist";
import { getCustomer } from "@/lib/customer";
import { wishlistProductIds } from "@ecom/services";
import { getTemplate, templateCssVars } from "@ecom/ui/website-templates";
import { websiteSettings } from "@/lib/website";
import "./globals.css";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await websiteSettings();
  return {
    metadataBase: new URL(process.env.WEB_URL ?? "http://localhost:3000"),
    title: { default: seo.title || `${brand.name}: Custom Photo Frames & Resin Art Frames`, template: `%s | ${brand.name}` },
    description: seo.description || "Custom photo frames, collage frames and handmade resin (glue-art) frames. Upload your photo, add names and design your own.",
    openGraph: { siteName: brand.name, type: "website", locale: "en_IN" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const s = await websiteSettings();
  return { themeColor: getTemplate(s.template).colors.primary };
}

// Every page includes the DB-driven header/footer (live categories, store
// settings), so nothing may be prerendered at build time: builds run without
// database access (Railway's private network isn't reachable during builds).
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [customer, site] = await Promise.all([getCustomer(), websiteSettings()]);
  const wishlistIds = customer ? await wishlistProductIds({ userId: customer.userId }) : [];
  // Template colours and shapes as CSS variables (vetted values only; see website-templates.ts).
  const themeVars = templateCssVars(site.template, site.corners, site.headingFont) as React.CSSProperties;
  return (
    <ClerkProvider signInUrl="/login" signUpUrl="/register" afterSignOutUrl="/" appearance={clerkAppearance}>
    <html lang="en-IN" className={`${sora.variable} ${inter.variable} ${designFontVariables}`} style={themeVars} data-template={site.template}>
      <body className="flex min-h-screen flex-col antialiased">
        <Preloader />
        <Suspense>
          <NavigationLoader />
        </Suspense>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
          Skip to content
        </a>
        {/* Keyed by the signed-in user: sign-in/out happens without a full reload,
            so the provider must remount to pick up that user's wishlist. */}
        <WishlistProvider key={customer?.userId ?? "guest"} signedIn={!!customer} initialIds={wishlistIds}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </WishlistProvider>
      </body>
    </html>
    </ClerkProvider>
  );
}
