import { brand } from "@ecom/ui/brand";
import { Mail } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact us" };

export default function ContactPage() {
  return (
    <div className="container-store max-w-3xl py-12">
      <h1 className="font-display text-3xl font-bold">Contact us</h1>
      <p className="mt-4 text-muted-foreground">Questions about a product, an order or a custom design? Write to us and we&apos;ll get back to you.</p>
      <a
        href={`mailto:${brand.supportEmail}`}
        className="mt-6 inline-flex items-center gap-3 rounded-xl border border-border p-5 hover:border-primary"
      >
        <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
        <span>
          <span className="block text-sm font-semibold">Email</span>
          <span className="block text-sm text-muted-foreground">{brand.supportEmail}</span>
        </span>
      </a>
      {/* An in-store support form (support tickets) arrives with the customer account area. */}
    </div>
  );
}
