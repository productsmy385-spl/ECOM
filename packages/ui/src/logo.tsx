/**
 * Adira logo. The mark is a photo frame (white mat inside a crimson tile)
 * holding a bold "A" whose crossbar is a small heart: custom frames, made
 * with love. Original artwork; colours from the brand palette.
 */

export function AdiraMark({ size = 36, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <rect width="64" height="64" rx="16" fill="#CF0F47" />
      {/* the frame's mat */}
      <rect x="9.5" y="9.5" width="45" height="45" rx="9" fill="none" stroke="#FFFFFF" strokeWidth="3.2" />
      {/* the A */}
      <path d="M21.5 45.5 L32 18.5 L42.5 45.5" fill="none" stroke="#FFFFFF" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* heart crossbar */}
      <path d="M32 40.6c-.4-.37-4.6-3.85-4.6-6.55 0-1.55 1.2-2.75 2.65-2.75.85 0 1.55.42 1.95 1.05.4-.63 1.1-1.05 1.95-1.05 1.45 0 2.65 1.2 2.65 2.75 0 2.7-4.2 6.18-4.6 6.55z" fill="#FFDEDE" transform="translate(32 37) scale(1.2) translate(-32 -36)" />
    </svg>
  );
}

/** Mark + "Adira" wordmark. The wordmark uses the display font and inherits text colour (works in dark mode). */
export function AdiraLogo({ size = 36, className, name = "Adira", tagline }: { size?: number; className?: string; name?: string; tagline?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <AdiraMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.62 }}>
          {name}
        </span>
        {tagline && <span className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] opacity-60">{tagline}</span>}
      </span>
    </span>
  );
}

/** Raw SVG of the mark, for favicons and app icons. */
export const ADIRA_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#CF0F47"/><rect x="9.5" y="9.5" width="45" height="45" rx="9" fill="none" stroke="#FFFFFF" stroke-width="3.2"/><path d="M21.5 45.5 L32 18.5 L42.5 45.5" fill="none" stroke="#FFFFFF" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 40.6c-.4-.37-4.6-3.85-4.6-6.55 0-1.55 1.2-2.75 2.65-2.75.85 0 1.55.42 1.95 1.05.4-.63 1.1-1.05 1.95-1.05 1.45 0 2.65 1.2 2.65 2.75 0 2.7-4.2 6.18-4.6 6.55z" fill="#FFDEDE" transform="translate(32 37) scale(1.2) translate(-32 -36)"/></svg>`;
