import { listAddresses } from "@ecom/services";
import { INDIAN_STATES } from "@ecom/validation";
import type { Metadata } from "next";
import { requireCustomer } from "@/lib/customer";
import { AddressBook } from "./address-book";

export const metadata: Metadata = { title: "Addresses", robots: { index: false } };

export default async function AddressesPage() {
  const c = await requireCustomer("/account/addresses");
  const list = await listAddresses({ userId: c.userId });
  return <AddressBook initial={list} states={[...INDIAN_STATES]} />;
}
