import { getCart } from "@ecom/services";
import type { Metadata } from "next";
import { resolveShopper } from "@/lib/design-owner";
import { NOBODY } from "@/lib/shop-route";
import { CartView } from "./cart-view";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default async function CartPage() {
  const shopper = await resolveShopper({ create: false });
  const cart = await getCart(shopper ?? NOBODY);
  return (
    <div className="container-store py-8 sm:py-12">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Your bag</h1>
      <CartView initial={JSON.parse(JSON.stringify(cart))} />
    </div>
  );
}
