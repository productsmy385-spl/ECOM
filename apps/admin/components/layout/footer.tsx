import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/** "Designed by Kranas Tech" (see config/site.ts). */
export function BrandCredit({ className }: { className?: string }) {
  return <p className={cn("text-xs text-muted-foreground", className)}>Designed by {siteConfig.credit}</p>;
}

export function Footer() {
  return (
    <footer className="mt-8 flex flex-col gap-2 border-t border-border/80 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        &copy; {new Date().getFullYear()} {siteConfig.brand}
      </span>
      <BrandCredit />
    </footer>
  );
}
