export const siteConfig = {
  name: `${process.env.NEXT_PUBLIC_BRAND_NAME ?? "Crimsonne"} Admin`,
  brand: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Crimsonne",
  description: "Store administration: catalog, orders, designs, deliveries and reports.",
  /**
   * Footer credit. Replaced the DataDropX credit on 2026-11-11 at the owner's
   * explicit request (knowledge-base/OPEN_QUESTIONS.md #7a), knowing the DropX
   * Admin licence asks for that credit.
   */
  credit: "Kranas Tech",
} as const;
