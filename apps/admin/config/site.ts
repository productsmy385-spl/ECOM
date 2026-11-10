export const siteConfig = {
  name: `${process.env.NEXT_PUBLIC_BRAND_NAME ?? "Crimsonne"} Admin`,
  brand: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Crimsonne",
  description: "Store administration: catalog, orders, designs, deliveries and reports.",
  /**
   * Required by the DropX Admin License (condition 2): the admin UI must keep a
   * visible, readable "Designed & developed by DataDropX" credit linking to
   * https://datadropx.net. Do not remove — see components/layout/footer.tsx.
   */
  templateCredit: {
    name: "DataDropX",
    url: "https://datadropx.net",
  },
} as const;
