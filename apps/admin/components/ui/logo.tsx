import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { AdiraMark } from "@ecom/ui/logo";

interface LogoMarkProps {
  className?: string;
  showWordmark?: boolean;
}

/** Adira mark (photo frame + A with a heart crossbar) with the "Admin" wordmark. */
export function LogoMark({ className, showWordmark = true }: LogoMarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <AdiraMark size={36} className="shrink-0" />
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
