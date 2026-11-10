import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact rating pill (Flipkart-style) — hidden when there are no ratings. */
export function RatingPill({ avg, count, className }: { avg: number; count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span className="inline-flex items-center gap-0.5 rounded bg-success px-1.5 py-0.5 font-semibold text-white">
        {avg.toFixed(1)} <Star className="h-3 w-3 fill-current" aria-hidden="true" />
      </span>
      <span className="text-muted-foreground">({count.toLocaleString("en-IN")})</span>
      <span className="sr-only">
        Rated {avg.toFixed(1)} out of 5 from {count} reviews
      </span>
    </span>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex", className)} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={cn("h-4 w-4", i <= Math.round(value) ? "fill-highlight text-highlight" : "text-border")}
        />
      ))}
    </span>
  );
}
