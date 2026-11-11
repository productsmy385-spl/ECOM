"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormAlert } from "@/components/auth/auth-shell";

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
        <Field label="Email" name="email" defaultValue={initial.email} readOnly hint="Change your sign-in email under Sign-in & security below." className="h-11 w-full rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground" />
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
