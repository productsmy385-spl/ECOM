import { getProfile, listSessions } from "@ecom/services";
import type { Metadata } from "next";
import { requireCustomer } from "@/lib/customer";
import { PasswordForm, ProfileForm, SessionsCard } from "./forms";

export const metadata: Metadata = { title: "Profile & security", robots: { index: false } };

export default async function ProfilePage() {
  const c = await requireCustomer("/account/profile");
  const [profile, sessions] = await Promise.all([getProfile({ userId: c.userId }), listSessions({ userId: c.userId })]);
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
      <PasswordForm />
      <SessionsCard
        sessions={sessions.map((s) => ({
          id: s.id,
          device: describeDevice(s.userAgent),
          lastActive: s.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}

function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}
