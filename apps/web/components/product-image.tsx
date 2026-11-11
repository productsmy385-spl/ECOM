import { Flower2, Frame, Palette } from "lucide-react";
import Image from "next/image";
import { cn, ik } from "@/lib/utils";

/**
 * Product image with a designed placeholder when the product has no photo yet
 * (no stock imagery is used anywhere in the store).
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority,
  className,
  hint,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Used to choose the placeholder motif. */
  hint?: string;
}) {
  if (!src) {
    const h = (hint ?? alt).toLowerCase();
    const Icon = /resin|glu|flower/.test(h) ? Flower2 : /custom|design|personal|name/.test(h) ? Palette : Frame;
    return (
      <div
        role="img"
        aria-label={`${alt}: image coming soon`}
        className={cn("flex h-full w-full flex-col items-center justify-center gap-2 bg-blush-50 text-primary/70", className)}
      >
        <Icon className="h-10 w-10" strokeWidth={1.25} aria-hidden="true" />
        <span className="text-2xs font-medium uppercase tracking-widest text-primary/60">Image coming soon</span>
      </div>
    );
  }
  return (
    <Image
      src={ik(src, 800)}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
    />
  );
}
