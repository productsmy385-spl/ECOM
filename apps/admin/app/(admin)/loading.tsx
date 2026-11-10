import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/skeleton";

// Shown while an admin page streams in during navigation
export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkeletonTable rows={5} />
        </div>
        <SkeletonCard />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
