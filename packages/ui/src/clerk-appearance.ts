/**
 * Brand theme for Clerk's sign-in / sign-up / profile components, shared by the
 * storefront and the admin. A plain object, so this package needs no Clerk dependency.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#CF0F47",
    colorDanger: "#B42318",
    borderRadius: "0.625rem",
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    headerTitle: { fontFamily: "var(--font-sora), ui-sans-serif, system-ui, sans-serif" },
    formButtonPrimary: { textTransform: "none", fontWeight: 600 },
  },
} as const;

/**
 * Embedded variant: our page supplies the title and frame, so Clerk's own card
 * chrome and header are removed. Used where the form sits inside our layout.
 */
export const clerkEmbeddedAppearance = {
  ...clerkAppearance,
  elements: {
    ...clerkAppearance.elements,
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", border: "none" },
    card: { boxShadow: "none", border: "none", padding: 0, background: "transparent" },
    header: { display: "none" },
  },
} as const;
