/** Money is stored as integer paise everywhere; these helpers are the only place it becomes rupees. */
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatPaise(paise: number, opts: { whole?: boolean } = {}): string {
  const rupees = paise / 100;
  return (opts.whole || Number.isInteger(rupees) ? inrWhole : inr).format(rupees);
}

export function formatNumberIN(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatCompactIN(value: number): string {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function discountPercent(price: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function formatDateIN(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", ...opts });
}
