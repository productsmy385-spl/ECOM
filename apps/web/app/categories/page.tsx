import { ArrowRight, Glasses, Palette, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { navCategories } from "@/lib/catalog";
import { ik } from "@/lib/utils";

export const metadata: Metadata = { title: "All categories", alternates: { canonical: "/categories" } };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const cats = await navCategories();
  return (
    <div className="container-store py-8">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">All categories</h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cats.map((c) => {
          const Icon = /frame|glass|sun|eye/i.test(c.name) ? Glasses : /custom/i.test(c.name) ? Palette : Sparkles;
          return (
            <li key={c.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
              <Link href={`/shop?category=${c.slug}`} className="group">
                <span className="relative flex aspect-[16/10] items-center justify-center bg-blush-50 text-primary">
                  {c.imageUrl ? (
                    <Image src={ik(c.imageUrl, 600)} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
                  ) : (
                    <Icon className="h-10 w-10" strokeWidth={1.25} aria-hidden="true" />
                  )}
                </span>
                <span className="flex items-center justify-between p-4 font-display font-semibold group-hover:text-primary">
                  {c.name} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
              {c.children.length > 0 && (
                <ul className="flex flex-wrap gap-2 px-4 pb-4">
                  {c.children.map((ch) => (
                    <li key={ch.id}>
                      <Link href={`/shop?category=${ch.slug}`} className="inline-block rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary">
                        {ch.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
