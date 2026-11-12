/**
 * Animated Adira mark used as the loading indicator in both apps: the mark
 * swings gently from its handle while the swoosh draws itself around the bag. Pure SVG +
 * CSS (no JS), so it animates even before React hydrates. Respects
 * prefers-reduced-motion (shows the still logo, softly pulsing).
 *
 * Class and gradient ids carry an `adl-` prefix; render one loader at a time.
 */
export function AdiraLoader({ size = 72, label = "Loading", className }: { size?: number; label?: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={className} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="75 30 1140 1140" aria-hidden="true" className="adl-root">
        <style>{`
          .adl-bag { transform-box: view-box; transform-origin: 640px 96px; animation: adl-swing 1.6s ease-in-out infinite; }
          .adl-sweep { clip-path: inset(0 100% 0 0); animation: adl-sweep 1.6s cubic-bezier(.65,0,.35,1) infinite; }
          .adl-shine { animation: adl-shine 1.6s ease-in-out infinite; }
          @keyframes adl-swing { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
          @keyframes adl-sweep { 0% { clip-path: inset(0 100% 0 0); opacity: 1; } 60% { clip-path: inset(0 0 0 0); opacity: 1; } 88%,100% { clip-path: inset(0 0 0 0); opacity: .15; } }
          @keyframes adl-shine { 0%,100% { opacity: 0; } 50% { opacity: .14; } }
          @media (prefers-reduced-motion: reduce) {
            .adl-bag, .adl-sweep { animation: none; }
            .adl-sweep { clip-path: none; }
            .adl-root { animation: adl-pulse 1.8s ease-in-out infinite; }
            @keyframes adl-pulse { 0%,100% { opacity: 1; } 50% { opacity: .6; } }
          }
        `}</style>
        <defs>
          <linearGradient id="adl-body" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D3124C" />
            <stop offset="0.55" stopColor="#B20E40" />
            <stop offset="1" stopColor="#76082A" />
          </linearGradient>
          <linearGradient id="adl-handle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C8124A" />
            <stop offset="1" stopColor="#860A30" />
          </linearGradient>
          <linearGradient id="adl-inner" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF2A66" />
            <stop offset="1" stopColor="#F00D4D" />
          </linearGradient>
          <linearGradient id="adl-leg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7A0829" />
            <stop offset="1" stopColor="#F0104F" />
          </linearGradient>
          <linearGradient id="adl-swoosh" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#FF2D6A" />
            <stop offset="0.3" stopColor="#FF8AB0" />
            <stop offset="0.7" stopColor="#FF4A82" />
            <stop offset="1" stopColor="#E8125A" />
          </linearGradient>
          <mask id="adl-counter">
            <rect x="0" y="0" width="1290" height="1230" fill="#fff" />
            <path d="M645 668 L572 806 L776 772 Z" fill="#000" />
          </mask>
        </defs>

        <g className="adl-bag">
          <path d="M470 432 V318 C470 168 556 96 640 96 C724 96 810 168 810 318 V432" fill="none" stroke="url(#adl-handle)" strokeWidth="64" strokeLinecap="round" />
          <g mask="url(#adl-counter)">
            <path d="M388 335 H936 Q978 335 988 376 L1032 566 L700 720 L128 988 L330 376 Q342 335 388 335 Z" fill="url(#adl-body)" />
            <path d="M655 400 L878 740 L640 860 L250 990 Z" fill="url(#adl-inner)" />
          </g>
          <path d="M672 930 L940 820 L1084 1108 L872 1108 Q800 990 672 930 Z" fill="url(#adl-leg)" />
          <circle cx="452" cy="425" r="40" fill="#fff" />
          <circle cx="452" cy="425" r="24" fill="#860A30" />
          <circle cx="824" cy="425" r="40" fill="#fff" />
          <circle cx="824" cy="425" r="24" fill="#860A30" />
          {/* soft highlight pulse on the bag front */}
          <path className="adl-shine" d="M655 400 L878 740 L640 860 L250 990 Z" fill="#fff" mask="url(#adl-counter)" />

          <path
          className="adl-sweep"
          d="M1030 522 C1132 528 1196 570 1172 632 C1144 708 1000 812 812 892 C600 980 330 1030 190 1110 C140 1140 92 1118 112 1084 C240 975 470 905 618 846 C800 768 1040 682 1090 640 C1126 610 1102 584 1030 576 Z"
          fill="url(#adl-swoosh)"
          />
        </g>
      </svg>
      {label && <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>{label}…</span>}
    </span>
  );
}
