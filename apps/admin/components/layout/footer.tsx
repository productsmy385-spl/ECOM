import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Attribution required by the DropX Admin License, condition 2:
 * "Designed & developed by DataDropX" with a readable link to https://datadropx.net
 * must stay visible in the admin UI. Restyling is allowed; removal is not.
 */
export function BrandCredit({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Designed &amp; developed by{" "}
      <a
        href={siteConfig.templateCredit.url}
        target="_blank"
        rel="noopener"
        className="font-semibold text-link transition-colors hover:underline"
      >
        {siteConfig.templateCredit.name}
      </a>
    </p>
  );
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
