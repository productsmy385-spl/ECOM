import { cn } from "@/lib/utils";

export type GradientVariant = "primary" | "success" | "warning" | "info" | "dark" | "rose";

interface GradientCardProps {
  title: string;
  value: React.ReactNode;
  /** Small line under the value, e.g. "12 this week". */
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: GradientVariant;
  href?: string;
  className?: string;
}

/**
 * DropX-style metric card: gradient surface, two soft circles, label + icon
 * chip on top, big value, optional hint. Colours are the Adira palette.
 */
export function GradientCard({ title, value, hint, icon, variant = "primary", className }: GradientCardProps) {
  return (
    <div className={cn(`gradient-${variant} relative overflow-hidden rounded-xl p-5 text-white shadow-card animate-fade-in-up`, className)}>
      <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-white/10" aria-hidden="true" />
      <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/5" aria-hidden="true" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-xs font-medium text-white/85">{title}</p>
          {icon && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/15 [&_svg]:h-4 [&_svg]:w-4">{icon}</div>}
        </div>
        <p className="mt-2 font-display text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        {hint && <p className="mt-1.5 text-xs text-white/80">{hint}</p>}
      </div>
    </div>
  );
}

/** DropX's compact white stat card (icon chip on the left), for secondary metrics. */
export function StatCard({ title, value, icon, tone, className }: { title: string; value: React.ReactNode; icon: React.ReactNode; tone: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card animate-fade-in-up", className)}>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg [&_svg]:h-5 [&_svg]:w-5", tone)}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{title}</p>
        <p className="font-display text-lg font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}
