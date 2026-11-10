/** Brand constants for places CSS tokens can't reach (emails, PDFs, meta theme-color). */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Crimsonne",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com",
  colors: {
    black: "#000000",
    crimson: "#CF0F47",
    hotPink: "#FF0B55",
    lightPink: "#FFDEDE",
    white: "#FFFFFF",
  },
} as const;
