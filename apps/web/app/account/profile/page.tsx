import { UserProfile } from "@clerk/nextjs";
import { getProfile } from "@ecom/services";
import { clerkAppearance } from "@ecom/ui/clerk-appearance";
import type { Metadata } from "next";
import { requireCustomer } from "@/lib/customer";
import { ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Profile & security", robots: { index: false } };

export default async function ProfilePage() {
  const c = await requireCustomer("/account/profile");
  const profile = await getProfile({ userId: c.userId });
  return (
    <div className="space-y-6">
      <ProfileForm
        initial={{
          name: profile.name,
          email: profile.email,
          phone: profile.phone?.replace(/^\+91/, "") ?? "",
          dateOfBirth: profile.dateOfBirth ?? "",
          marketingOptIn: profile.marketingOptIn,
        }}
      />
      <section aria-labelledby="security-heading" className="space-y-3">
        <div>
          <h2 id="security-heading" className="font-display text-lg font-semibold">
            Sign-in &amp; security
          </h2>
          <p className="text-sm text-muted-foreground">
            Password, email, connected accounts and the devices you&apos;re signed in on.
          </p>
        </div>
        <div className="overflow-x-auto">
          <UserProfile routing="hash" appearance={clerkAppearance} />
        </div>
      </section>
    </div>
  );
}