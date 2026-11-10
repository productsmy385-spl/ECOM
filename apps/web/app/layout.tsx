import { brand } from "@ecom/ui/brand";
import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.WEB_URL ?? "http://localhost:3000"),
  title: { default: `${brand.name} — Cosmetics, Eyewear & Custom Designs`, template: `%s | ${brand.name}` },
  description: "Shop cosmetics, eyeglass frames, sunglasses and accessories — or design your own.",
};

export const viewport: Viewport = { themeColor: "#CF0F47" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${sora.variable} ${inter.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
