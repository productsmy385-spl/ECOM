/**
 * Adira logo: the owner's mark (2026-11-12): a crimson shopping bag whose body
 * forms an "A", wrapped by a pink swoosh. Redrawn as clean vector from the
 * owner's artwork (source: knowledge-base/brand/adira-logo-source.png), so it
 * stays sharp from favicon to hero size and has a transparent background.
 *
 * Rendered as an <img> (data URI): the SVG's gradient ids stay isolated, so
 * several logos on one page never clash.
 */

/** Raw SVG of the mark (also the favicon: app/icon.svg in both apps). */
export const ADIRA_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="75 30 1140 1140"><defs><linearGradient id="body" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D3124C"/><stop offset="0.55" stop-color="#B20E40"/><stop offset="1" stop-color="#76082A"/></linearGradient><linearGradient id="handle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C8124A"/><stop offset="1" stop-color="#860A30"/></linearGradient><linearGradient id="inner" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF2A66"/><stop offset="1" stop-color="#F00D4D"/></linearGradient><linearGradient id="leg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7A0829"/><stop offset="1" stop-color="#F0104F"/></linearGradient><linearGradient id="swoosh" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FF2D6A"/><stop offset="0.3" stop-color="#FF8AB0"/><stop offset="0.7" stop-color="#FF4A82"/><stop offset="1" stop-color="#E8125A"/></linearGradient><mask id="counter"><rect width="1290" height="1230" fill="#fff"/><path d="M645 668 L572 806 L776 772 Z" fill="#000"/></mask></defs><path d="M470 432 V318 C470 168 556 96 640 96 C724 96 810 168 810 318 V432" fill="none" stroke="url(#handle)" stroke-width="64" stroke-linecap="round"/><g mask="url(#counter)"><path d="M388 335 H936 Q978 335 988 376 L1032 566 L700 720 L128 988 L330 376 Q342 335 388 335 Z" fill="url(#body)"/><path d="M655 400 L878 740 L640 860 L250 990 Z" fill="url(#inner)"/></g><path d="M672 930 L940 820 L1084 1108 L872 1108 Q800 990 672 930 Z" fill="url(#leg)"/><circle cx="452" cy="425" r="40" fill="#fff"/><circle cx="452" cy="425" r="24" fill="#860A30"/><circle cx="824" cy="425" r="40" fill="#fff"/><circle cx="824" cy="425" r="24" fill="#860A30"/><path d="M1030 522 C1132 528 1196 570 1172 632 C1144 708 1000 812 812 892 C600 980 330 1030 190 1110 C140 1140 92 1118 112 1084 C240 975 470 905 618 846 C800 768 1040 682 1090 640 C1126 610 1102 584 1030 576 Z" fill="url(#swoosh)"/></svg>`;

const MARK_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ADIRA_MARK_SVG)}`;

export function AdiraMark({ size = 36, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny inline SVG; next/image adds nothing here
    <img src={MARK_URI} width={size} height={size} alt={title ?? ""} aria-hidden={title ? undefined : true} className={className} draggable={false} />
  );
}

/** Mark + "Adira" wordmark. The wordmark uses the display font and inherits text colour (works in dark mode). */
export function AdiraLogo({ size = 36, className, name = "Adira", tagline }: { size?: number; className?: string; name?: string; tagline?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
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
