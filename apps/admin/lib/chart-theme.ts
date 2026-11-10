import type { CSSProperties } from "react";

// Theme-aware series colours; values come from --chart-* tokens in @ecom/ui/tokens.css
export const chartColors = {
  primary: "var(--chart-1)",
  highlight: "var(--chart-2)",
  success: "var(--chart-3)",
  warning: "var(--chart-4)",
  info: "var(--chart-5)",
  violet: "var(--chart-6)",
  teal: "var(--chart-7)",
  muted: "var(--chart-muted)",
  // Aliases used by DropX components
  danger: "var(--destructive)",
  pink: "var(--chart-2)",
} as const;

export const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 };

const tooltipContent: CSSProperties = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  boxShadow: "var(--shadow-dropdown)",
  fontSize: "12px",
  padding: "8px 10px",
};

// Spread onto <Tooltip /> so every chart shares one readable tooltip in both themes
export const tooltipProps = {
  contentStyle: tooltipContent,
  labelStyle: { color: "var(--foreground)", fontWeight: 600, marginBottom: 2 },
  cursor: { fill: "var(--muted)", fillOpacity: 0.5, stroke: "var(--border)" },
};
