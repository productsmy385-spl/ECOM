"use client";

import type { NavCategory } from "@ecom/services";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/** Off-canvas navigation for small screens. */
export function MobileNav({ categories, brand }: { categories: NavCategory[]; brand: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[86vw] max-w-sm flex-col bg-card shadow-modal transition-transform duration-500 ease-in-out focus:outline-none data-[state=open]:animate-[slide-in-right_0.5s_ease-in-out]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="font-display text-lg font-bold">{brand}</Dialog.Title>
            <Dialog.Close className="spin-on-hover rounded-lg p-2 hover:bg-muted" aria-label="Close menu">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Shop by category</Dialog.Description>
          <nav className="flex-1 overflow-y-auto p-2" aria-label="Mobile">
            <Link href="/shop" onClick={close} className="flex items-center justify-between rounded-lg px-3 py-3 font-medium hover:bg-muted">
              Shop all <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/shop?tag=new" onClick={close} className="flex items-center justify-between rounded-lg px-3 py-3 font-medium hover:bg-muted">
              New arrivals <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/shop?tag=custom" onClick={close} className="flex items-center justify-between rounded-lg px-3 py-3 font-medium text-primary hover:bg-muted">
              Design your own <ChevronRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 px-3 pb-1 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">Categories</p>
            {categories.map((c) => (
              <div key={c.id}>
                <Link href={`/shop?category=${c.slug}`} onClick={close} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted">
                  {c.name} <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                {c.children.map((ch) => (
                  <Link key={ch.id} href={`/shop?category=${ch.slug}`} onClick={close} className="block rounded-lg py-2 pl-7 pr-3 text-sm text-muted-foreground hover:bg-muted">
                    {ch.name}
                  </Link>
                ))}
              </div>
            ))}
            <div className="mt-3 border-t border-border pt-3">
              <Link href="/about" onClick={close} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-muted">
                About us
              </Link>
              <Link href="/contact" onClick={close} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-muted">
                Contact
              </Link>
            </div>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
