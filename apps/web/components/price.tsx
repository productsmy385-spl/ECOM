import { discountPercent, formatPaise } from "@ecom/ui/format";
import { cn } from "@/lib/utils";

export function Price({
  price,
  compareAt,
  size = "md",
  className,
}: {
  price: number;
  compareAt?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const off = discountPercent(price, compareAt);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span
        className={cn(
          "font-display font-semibold tabular-nums text-foreground",
          size === "lg" ? "text-3xl" : size === "md" ? "text-base" : "text-sm",
        )}
      >
        {formatPaise(price)}
      </span>
      {off > 0 && compareAt && (
        <>
          <span className={cn("text-muted-foreground line-through tabular-nums", size === "lg" ? "text-base" : "text-xs")}>
            <span className="sr-only">MRP </span>
            {formatPaise(compareAt)}
          </span>
          <span className={cn("font-semibold text-success", size === "lg" ? "text-base" : "text-xs")}>{off}% off</span>
        </>
      )}
    </div>
  );
}
