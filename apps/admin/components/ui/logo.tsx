import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  showWordmark?: boolean;
}

/** Placeholder brand mark (monogram) until the real logo is supplied. */
export function LogoMark({ className, showWordmark = true }: LogoMarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-base font-bold text-primary-foreground"
      >
        {siteConfig.brand.charAt(0)}
      </span>
      {showWordmark && (
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-bold leading-none text-foreground">
            {siteConfig.brand}
          </p>
          <p className="mt-1 truncate text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Admin
          </p>
        </div>
      )}
    </div>
  );
}
