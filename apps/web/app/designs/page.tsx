import { listMyDesigns } from "@ecom/services";
import { formatDateIN } from "@ecom/ui/format";
import { Palette } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { resolveDesignOwner } from "@/lib/design-owner";
import { CUSTOMER_STATUS } from "./status";

export const metadata: Metadata = { title: "My designs", robots: { index: false } };

export default async function MyDesignsPage() {
  const owner = await resolveDesignOwner({ create: false });
  const designs = owner ? await listMyDesigns(owner) : [];

  return (
    <div className="container-store max-w-4xl py-8">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">My designs</h1>
      <p className="mt-1 text-sm text-muted-foreground">Designs saved on this device. Sign-in to keep them across devices is coming with customer accounts.</p>
      {designs.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <Palette className="h-9 w-9 text-primary" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-semibold">No designs yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Pick a customisable product and make it yours.</p>
          <Link href="/shop?tag=custom" className="mt-5 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            Browse customisable products
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {designs.map((d) => {
            const s = CUSTOMER_STATUS[d.status] ?? CUSTOMER_STATUS.draft!;
            return (
              <li key={d.id}>
                <Link href={`/designs/${d.id}`} className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-muted/40">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{d.productName} · updated {formatDateIN(d.updatedAt)}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.tone}`}>{s.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
