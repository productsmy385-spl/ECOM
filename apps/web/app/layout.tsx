import { brand } from "@ecom/ui/brand";
import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.WEB_URL ?? "http://localhost:3000"),
  title: { default: `${brand.name}: Cosmetics, Eyewear & Custom Designs`, template: `%s | ${brand.name}` },
  description: "Shop cosmetics, eyeglass frames, sunglasses and accessories, or design your own.",
  openGraph: { siteName: brand.name, type: "website", locale: "en_IN" },
};

export const viewport: Viewport = { themeColor: "#CF0F47" };

// Every page includes the DB-driven header/footer (live categories, store
// settings), so nothing may be prerendered at build time: builds run without
// database access (Railway's private network isn't reachable during builds).
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${sora.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
