import { AuthBrand } from "@/components/layout/auth-brand";
import { getStaffSession } from "@/lib/session";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getStaffSession()) redirect("/dashboard");

  return (
    <div className="grid w-full lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-white lg:flex">
        <AuthBrand className="[&_p]:text-white [&_p+p]:text-white/60" />
        <div>
          <h2 className="font-display text-3xl font-bold leading-tight">
            Run the store,
            <br />
            <span className="text-hotpink">end to end.</span>
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            Catalog, orders, custom designs, deliveries and reports, in one place.
          </p>
        </div>
        <p className="text-xs text-white/50">Staff access only. Activity is audited.</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          <AuthBrand className="lg:hidden" />
          <div>
            <h1 className="text-2xl font-bold">Staff sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the email your administrator registered for you.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
