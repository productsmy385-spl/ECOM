import { brand } from "@ecom/ui/brand";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About us" };

// Placeholder copy limited to facts about the offering; replace with the business's own story.
export default function AboutPage() {
  return (
    <div className="container-store max-w-3xl py-12">
      <h1 className="font-display text-3xl font-bold">About {brand.name}</h1>
      <div className="mt-6 space-y-4 text-muted-foreground">
        <p>
          {brand.name} sells cosmetics, eyeglass frames, sunglasses and accessories, and lets you personalise many of them:
          frame colours and engraving, cosmetic shades, labels and gift packaging.
        </p>
        <p>
          Every price in the store includes GST. Questions about a product or an order? We&apos;re happy to help.
        </p>
      </div>
      <Link href="/contact" className="mt-8 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
        Contact us
      </Link>
    </div>
  );
}
