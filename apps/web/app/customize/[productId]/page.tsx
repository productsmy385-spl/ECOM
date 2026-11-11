import { type DesignView, getCustomizerData, getDesign, NotFoundError } from "@ecom/services";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Customizer } from "@/components/customizer/customizer";
import { resolveDesignOwner } from "@/lib/design-owner";

export const metadata: Metadata = { title: "Customise", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadDesign(designId: string | undefined, productId: string): Promise<DesignView | null> {
  if (!designId || !UUID.test(designId)) return null;
  const owner = await resolveDesignOwner({ create: false });
  if (!owner) return null;
  try {
    const d = await getDesign(owner, designId);
    return d.product.id === productId ? d : null;
  } catch (err) {
    if (err instanceof NotFoundError) return null; // not yours / gone: start fresh
    throw err;
  }
}

export default async function CustomizePage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ design?: string; v?: string }>;
}) {
  const [{ productId }, { design: designId, v }] = await Promise.all([params, searchParams]);
  if (!UUID.test(productId)) notFound();
  const data = await getCustomizerData(productId);
  if (!data) notFound();
  const design = await loadDesign(designId, productId);
  // Submitted/approved designs are read-only: show their status page instead.
  if (design && !design.canEdit) redirect(`/designs/${design.id}`);

  return (
    <div className="container-store py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-5 truncate text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/products/${data.product.slug}`} className="hover:text-foreground">{data.product.name}</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">Customise</span>
      </nav>
      {design?.status === "changes_requested" && design.feedback[0]?.comment && (
        <div role="status" className="mb-6 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-semibold">Our design team asked for a change</p>
          <p className="mt-1">“{design.feedback[0].comment}”</p>
        </div>
      )}
      <Customizer data={data} design={design} initialVariantSku={v} />
    </div>
  );
}
