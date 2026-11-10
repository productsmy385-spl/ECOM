import { LogoMark } from "@/components/ui/logo";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function AuthBrand({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex", className)} aria-label={siteConfig.name}>
      <LogoMark />
    </div>
  );
}
