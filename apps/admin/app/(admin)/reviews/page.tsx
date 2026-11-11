import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/session";
import { cn } from "@/lib/utils";
import { listReviewsAdmin } from "@ecom/services";
import { BadgeCheck, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ModerateButtons } from "./moderate-buttons";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending", label: "To moderate" },
  { key: "approved", label: "Published" },
  { key: "rejected", label: "Rejected" },
] as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { actor } = await requireStaff("reviews.moderate");
  const sp = await searchParams;
  const data = await listReviewsAdmin({ actor }, sp);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader title="Reviews" description="Customer reviews appear on the storefront after approval. Only verified buyers can write them." />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Review status">
        {TABS.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={data.status === t.key}
            href={`/reviews?status=${t.key}`}
            className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", data.status === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
          >
            {t.label} <span className="ml-1 opacity-75">{data.counts[t.key] ?? 0}</span>
          </Link>
        ))}
      </div>

      {data.items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nothing here.</Card>
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex text-warning" aria-label={`${r.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className="h-4 w-4" fill={n <= r.rating ? "currentColor" : "none"} aria-hidden="true" />
                      ))}
                    </span>
                    {r.title && <span className="font-semibold">{r.title}</span>}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <Link href={`/products/${r.productId}`} className="font-medium text-link hover:underline">
                      {r.productName}
                    </Link>
                    <span>·</span>
                    <span>
                      {r.author} ({r.email})
                    </span>
                    <span>·</span>
                    <span>{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    {r.verified && (
                      <span className="inline-flex items-center gap-0.5 text-success">
                        <BadgeCheck className="h-3.5 w-3.5" /> Verified purchase
                      </span>
                    )}
                  </p>
                </div>
                <ModerateButtons id={r.id} status={r.status} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex justify-center gap-2 text-sm">
          {data.page > 1 && <Link href={`/reviews?status=${data.status}&page=${data.page - 1}`} className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted">Previous</Link>}
          <span className="px-3 py-1.5 text-muted-foreground">
            Page {data.page} of {pages}
          </span>
          {data.page < pages && <Link href={`/reviews?status=${data.status}&page=${data.page + 1}`} className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted">Next</Link>}
        </nav>
      )}
    </div>
  );
}
