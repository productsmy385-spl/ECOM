"use client";

import { AreaChart } from "@/components/charts/area-chart";
import { chartColors } from "@/lib/chart-theme";
import { formatCompactIN } from "@ecom/ui/format";

type Point = { day: string; revenue: number; orders: number };

const day = (d: unknown) => new Date(`${String(d)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Paid revenue per day, last 30 days, in DropX's area-chart style (rupees). */
export function RevenueChart({ series }: { series: Point[] }) {
  const data = series.map((s) => ({ day: s.day, revenue: s.revenue / 100, orders: s.orders }));
  return (
    <AreaChart
      data={data}
      xKey="day"
      series={[{ key: "revenue", label: "Revenue", color: chartColors.primary }]}
      formatX={day}
      formatY={(v) => `₹${formatCompactIN(v)}`}
      ariaLabel="Paid revenue per day for the last 30 days"
    />
  );
}

/** Orders per day, same window, as a second analytics series. */
export function OrdersChart({ series }: { series: Point[] }) {
  return (
    <AreaChart
      data={series}
      xKey="day"
      height={220}
      series={[{ key: "orders", label: "Paid orders", color: chartColors.info }]}
      formatX={day}
      integer
      formatY={(v) => String(Math.round(v))}
      ariaLabel="Paid orders per day for the last 30 days"
    />
  );
}
