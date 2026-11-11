import { requireCustomer } from "@/lib/customer";
import { AccountNav } from "./account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const c = await requireCustomer("/account");
  return (
    <div className="container-store py-6 sm:py-8">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Signed in as {c.email}</p>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Hi, {c.name.split(" ")[0] || "there"}</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
