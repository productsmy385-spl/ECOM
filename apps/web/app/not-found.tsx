import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-store flex flex-col items-center py-24 text-center">
      <p className="font-display text-6xl font-bold text-primary">404</p>
      <h1 className="mt-3 font-display text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-muted-foreground">The product may have sold out or moved. Try searching, or browse the store.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/shop" className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          Browse the store
        </Link>
        <Link href="/" className="inline-flex h-11 items-center rounded-lg border border-input px-5 text-sm font-semibold hover:border-primary">
          Home
        </Link>
      </div>
    </div>
  );
}
