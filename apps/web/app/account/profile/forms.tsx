"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormAlert } from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

const card = "rounded-xl border border-border bg-card p-5 sm:p-6";
const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60";

export function ProfileForm({ initial }: { initial: { name: string; email: string; phone: string; dateOfBirth: string; marketingOptIn: boolean } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(f.get("name") ?? ""),
        phone: String(f.get("phone") ?? ""),
        dateOfBirth: String(f.get("dateOfBirth") ?? ""),
        marketingOptIn: f.get("marketingOptIn") === "on",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string[]> };
    setBusy(false);
    if (!res.ok) {
      setErrors(Object.fromEntries(Object.entries(body.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0] ?? ""])));
      return setMsg({ ok: false, text: body.error ?? "Couldn't save." });
    }
    setErrors({});
    setMsg({ ok: true, text: "Profile saved." });
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className={`${card} space-y-4`}>
      <h2 className="font-display text-lg font-semibold">Profile</h2>
      {msg && <FormAlert tone={msg.ok ? "ok" : "error"}>{msg.text}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name" defaultValue={initial.name} autoComplete="name" error={errors.name} />
        <Field label="Email" name="email" defaultValue={initial.email} readOnly hint="Contact us to change your email." className="h-11 w-full rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground" />
        <Field label="Mobile (optional)" name="phone" inputMode="tel" placeholder="98765 43210" defaultValue={initial.phone} autoComplete="tel-national" error={errors.phone} />
        <Field label="Date of birth (optional)" name="dateOfBirth" type="date" defaultValue={initial.dateOfBirth} error={errors.dateOfBirth} />
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="marketingOptIn" defaultChecked={initial.marketingOptIn} className="mt-0.5 h-4 w-4 accent-primary" />
        <span>Email me about new collections and offers</span>
      </label>
      <button type="submit" className={btn} disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const current = String(f.get("current") ?? "");
    const next = String(f.get("next") ?? "");
    if (next.length < 8 || !/[a-zA-Z]/.test(next) || !/\d/.test(next)) return setMsg({ ok: false, text: "New password: at least 8 characters with letters and numbers." });
    if (next !== String(f.get("confirm") ?? "")) return setMsg({ ok: false, text: "New passwords don't match." });
    setBusy(true);
    setMsg(null);
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    setBusy(false);
    if (error) {
      return setMsg({
        ok: false,
        text: error.status === 400 || error.status === 401 ? "Current password is incorrect. (Signed up with an email code? Use “Forgot password” to set one.)" : (error.message ?? "Couldn't change password."),
      });
    }
    form.reset();
    setMsg({ ok: true, text: "Password changed. Other devices were signed out." });
  }

  return (
    <form onSubmit={submit} noValidate className={`${card} space-y-4`}>
      <h2 className="font-display text-lg font-semibold">Password</h2>
      {msg && <FormAlert tone={msg.ok ? "ok" : "error"}>{msg.text}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Current password" name="current" type="password" autoComplete="current-password" />
        <Field label="New password" name="next" type="password" autoComplete="new-password" />
        <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" />
      </div>
      <button type="submit" className={btn} disabled={busy}>{busy ? "Updating…" : "Change password"}</button>
    </form>
  );
}

export function SessionsCard({ sessions }: { sessions: { id: string; device: string; lastActive: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function signOutOthers() {
    setBusy(true);
    const { error } = await authClient.revokeOtherSessions();
    setBusy(false);
    setMsg(error ? "Couldn't sign out other devices." : "Signed out of all other devices.");
    router.refresh();
  }

  return (
    <section className={`${card} space-y-4`}>
      <div>
        <h2 className="font-display text-lg font-semibold">Where you&apos;re signed in</h2>
        <p className="text-sm text-muted-foreground">If you don&apos;t recognise a device, sign it out and change your password.</p>
      </div>
      {msg && <FormAlert tone="ok">{msg}</FormAlert>}
      <ul className="divide-y divide-border text-sm">
        {sessions.map((s) => (
          <li key={s.id} className="flex justify-between gap-3 py-2.5">
            <span>{s.device}</span>
            <span className="text-muted-foreground">active {new Date(s.lastActive).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
          </li>
        ))}
      </ul>
      {sessions.length > 1 && (
        <button type="button" onClick={signOutOthers} disabled={busy} className="inline-flex h-10 items-center rounded-lg border border-input px-4 text-sm font-semibold hover:border-primary disabled:opacity-60">
          {busy ? "Signing out…" : "Sign out of other devices"}
        </button>
      )}
    </section>
  );
}
