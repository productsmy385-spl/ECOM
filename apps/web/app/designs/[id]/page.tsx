import { type DesignView, getDesign, NotFoundError } from "@ecom/services";
import { type CanvasConfig, DesignSurface } from "@ecom/ui/design";
import { formatDateIN, formatPaise } from "@ecom/ui/format";
import type { CanvasValue } from "@ecom/validation";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { ProductImage } from "@/components/product-image";
import { resolveDesignOwner } from "@/lib/design-owner";
import { CUSTOMER_STATUS } from "../status";
import { DesignActions } from "./design-actions";

export const metadata: Metadata = { title: "My design", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string): Promise<DesignView | null> {
  const owner = await resolveDesignOwner({ create: false });
  if (!owner) return null;
  try {
    return await getDesign(owner, id);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

export default async function DesignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const [{ id }, { submitted }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const d = await load(id);
  if (!d) notFound(); // other people's designs are indistinguishable from missing ones

  const s = CUSTOMER_STATUS[d.status] ?? CUSTOMER_STATUS.draft!;
  const canvas = d.options.find((o) => o.type === "canvas");
  const canvasValue = canvas ? (d.config.options[canvas.key] as CanvasValue | undefined) : undefined;
  const latestFeedback = d.feedback[0];

  return (
    <div className="container-store max-w-5xl py-8">
      <Link href="/designs" className="text-sm text-link hover:underline">← My designs</Link>
      {submitted && d.status !== "draft" && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-success/5 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="h-5 w-5" /> {d.status === "approved" ? "Your design is finished." : "Thanks! Your design was submitted."}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{d.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/products/${d.product.slug}`} className="hover:text-foreground">{d.product.name}</Link>
            {d.variant ? ` · ${d.variant.name}` : ""} · version {d.version} · updated {formatDateIN(d.updatedAt)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${s.tone}`}>{s.label}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{s.text}</p>

      {latestFeedback?.comment && (
        <div className="mt-5 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-semibold">Message from our design team · {formatDateIN(latestFeedback.createdAt)}</p>
          <p className="mt-1">“{latestFeedback.comment}”</p>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          {canvas ? (
            <div className="overflow-hidden rounded-2xl border border-border">
              <DesignSurface config={canvas.config as unknown as CanvasConfig} value={canvasValue ?? { layers: [] }} title={`${d.name} preview`} />
            </div>
          ) : (
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
              <ProductImage src={d.product.imageUrl} alt={d.product.name} hint={d.product.categoryName} sizes="(min-width: 1024px) 50vw, 100vw" />
            </div>
          )}
        </div>
        <div className="space-y-5">
          <dl className="divide-y divide-border rounded-xl border border-border bg-card px-4 text-sm">
            {d.summary.map((x) => (
              <div key={x.key} className="grid grid-cols-[40%_1fr] gap-3 py-2.5">
                <dt className="text-muted-foreground">{x.label}</dt>
                <dd className="break-words">{x.value}{x.priceDelta ? <span className="text-muted-foreground"> (+{formatPaise(x.priceDelta)})</span> : null}</dd>
              </div>
            ))}
            <div className="flex justify-between py-3 font-semibold">
              <dt>Price</dt>
              <dd className="font-display tabular-nums">{formatPaise(d.pricing.total)}</dd>
            </div>
          </dl>
          {Object.keys(d.missing).length > 0 && d.canEdit && (
            <p className="text-sm text-warning">Still to choose: {Object.values(d.missing).map((m) => m.replace(/ is required$/, "")).join(", ")}</p>
          )}
          {["submitted", "in_review", "approved"].includes(d.status) && d.variant && (
            <div className="space-y-1.5">
              <AddToCart variantId={d.variant.id} designId={d.id} disabled={!d.variant.inStock} />
              {d.status !== "approved" && (
                <p className="text-xs text-muted-foreground">You can order now. Our designers check it before production, and we&apos;ll contact you if anything needs changing.</p>
              )}
            </div>
          )}
          <DesignActions id={d.id} productId={d.product.id} canEdit={d.canEdit} status={d.status} />
        </div>
      </div>
    </div>
  );
}
