/**
 * Renders a design from its stored configuration. Used by the storefront
 * editor, the customer's design page and the admin review screen, so staff
 * approve exactly what the customer made. No hooks: works in server and
 * client components. Coordinates are normalised (0..1) to the canvas size.
 */
import { type CanvasValue, fontCss, type Layer, type OptionConfig } from "@ecom/validation";

export type CanvasConfig = OptionConfig<"canvas">;

export interface DesignSurfaceProps {
  config: CanvasConfig;
  value: CanvasValue;
  /** Dashed outline of the printable area (editor only). */
  showPrintArea?: boolean;
  /** Extra SVG drawn on top (selection handles in the editor). */
  overlay?: React.ReactNode;
  className?: string;
  title?: string;
  svgRef?: React.Ref<SVGSVGElement>;
  onPointerDown?: React.PointerEventHandler<SVGSVGElement>;
  onPointerMove?: React.PointerEventHandler<SVGSVGElement>;
  onPointerUp?: React.PointerEventHandler<SVGSVGElement>;
  layerProps?: (layer: Layer) => React.SVGProps<SVGGElement>;
}

export function layerTransform(layer: Layer, W: number, H: number): string {
  return `translate(${layer.x * W} ${layer.y * H}) rotate(${layer.rotation})`;
}

export function DesignLayer({ layer, W, H, ...rest }: { layer: Layer; W: number; H: number } & React.SVGProps<SVGGElement>) {
  if (!layer.visible) return null;
  return (
    <g transform={layerTransform(layer, W, H)} {...rest}>
      {layer.type === "text" ? (
        <text
          x={0}
          y={0}
          fontSize={layer.size * H}
          fill={layer.color}
          fontFamily={fontCss(layer.font)}
          fontWeight={layer.weight}
          fontStyle={layer.italic ? "italic" : "normal"}
          textAnchor={layer.align}
          dominantBaseline="central"
          style={{ whiteSpace: "pre" }}
        >
          {layer.text}
        </text>
      ) : (
        <image
          href={layer.url}
          x={(-layer.w * W) / 2}
          y={(-layer.h * H) / 2}
          width={layer.w * W}
          height={layer.h * H}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
    </g>
  );
}

export function DesignSurface({
  config,
  value,
  showPrintArea,
  overlay,
  className,
  title,
  svgRef,
  layerProps,
  ...handlers
}: DesignSurfaceProps) {
  const W = config.width;
  const H = config.height;
  const pa = config.printArea;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={title ?? "Design preview"}
      style={{ touchAction: "none", display: "block", width: "100%", height: "auto" }}
      {...handlers}
    >
      <rect width={W} height={H} fill={config.background.color} />
      {config.background.imageUrl && <image href={config.background.imageUrl} width={W} height={H} preserveAspectRatio="xMidYMid slice" />}
      {/* Layers are clipped to the canvas so off-canvas parts never print. */}
      <defs>
        <clipPath id="design-canvas-clip">
          <rect width={W} height={H} />
        </clipPath>
      </defs>
      <g clipPath="url(#design-canvas-clip)">
        {value.layers.map((layer) => (
          <DesignLayer key={layer.id} layer={layer} W={W} H={H} {...(layerProps?.(layer) ?? {})} />
        ))}
      </g>
      {showPrintArea && (
        <rect
          x={pa.x * W}
          y={pa.y * H}
          width={pa.w * W}
          height={pa.h * H}
          fill="none"
          stroke="#CF0F47"
          strokeOpacity={0.6}
          strokeDasharray={`${W / 120} ${W / 160}`}
          strokeWidth={W / 500}
          pointerEvents="none"
        />
      )}
      {overlay}
    </svg>
  );
}
