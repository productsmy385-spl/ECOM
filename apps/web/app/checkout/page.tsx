import { getCart, getCheckoutOptions, listAddresses } from "@ecom/services";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/customer";
import { resolveShopper } from "@/lib/design-owner";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const shopper = await resolveShopper({ create: false });
  if (!shopper) redirect("/cart");
  const [cart, options, customer] = await Promise.all([getCart(shopper), getCheckoutOptions(), getCustomer()]);
  if (!cart.canCheckout) redirect("/cart");
  if (!customer && !options.guestCheckoutEnabled) redirect("/login?next=%2Fcheckout");
  const saved = customer ? await listAddresses({ userId: customer.userId }) : [];

  return (
    <div className="container-store py-8 sm:py-12">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Checkout</h1>
      <CheckoutForm
        initialCart={JSON.parse(JSON.stringify(cart))}
        options={options}
        customer={customer ? { name: customer.name, email: customer.email } : null}
        savedAddresses={saved.map((a) => ({ id: a.id, label: a.label, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode, isDefault: a.isDefault }))}
        brand={process.env.NEXT_PUBLIC_BRAND_NAME ?? "Store"}
      />
    </div>
  );
}
