"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormAlert } from "@/components/auth/auth-shell";

interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
}

export function AddressBook({ initial, states }: { initial: Address[]; states: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string) {
    setError(null);
    const res = await fetch(url, { method });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Something went wrong.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Saved addresses</h2>
        <button type="button" onClick={() => setEditing("new")} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          <Plus className="h-4 w-4" /> Add address
        </button>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      {initial.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <MapPin className="h-8 w-8 text-primary" aria-hidden="true" />
          <p className="mt-3 font-semibold">No saved addresses</p>
          <p className="mt-1 text-sm text-muted-foreground">Add one now and checkout will be quicker.</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {initial.map((a) => (
            <li key={a.id} className="flex flex-col rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{a.fullName}</p>
                {a.label && <span className="rounded-full bg-muted px-2 py-0.5 text-2xs font-semibold uppercase">{a.label}</span>}
                {a.isDefault && <span className="rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold text-accent-foreground">Default</span>}
              </div>
              <address className="mt-2 flex-1 text-sm not-italic text-muted-foreground">
                {a.line1}
                {a.line2 && <>, {a.line2}</>}
                {a.landmark && <><br />Near {a.landmark}</>}
                <br />
                {a.city}, {a.state} {a.postalCode}
                <br />
                {a.phone}
              </address>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <button type="button" onClick={() => setEditing(a)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                {!a.isDefault && (
                  <button type="button" onClick={() => call(`/api/account/addresses/${a.id}`, "POST")} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted"><Star className="h-3.5 w-3.5" /> Make default</button>
                )}
                <button
                  type="button"
                  onClick={() => window.confirm("Delete this address?") && call(`/api/account/addresses/${a.id}`, "DELETE")}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-destructive hover:bg-destructive/5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AddressDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        address={editing === "new" ? null : editing}
        open={editing !== null}
        states={states}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function AddressDialog({ address, open, states, onClose, onSaved }: { address: Address | null; open: boolean; states: string[]; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(["label", "fullName", "phone", "line1", "line2", "landmark", "city", "state", "postalCode"].map((k) => [k, String(f.get(k) ?? "")]));
    setBusy(true);
    setFormError(null);
    const res = await fetch(address ? `/api/account/addresses/${address.id}` : "/api/account/addresses", {
      method: address ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, isDefault: f.get("isDefault") === "on" }),
    });
    const out = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string[]> };
    setBusy(false);
    if (!res.ok) {
      setErrors(Object.fromEntries(Object.entries(out.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0] ?? ""])));
      return setFormError(out.error ?? "Couldn't save the address.");
    }
    onSaved();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-card p-5 shadow-modal focus:outline-none sm:p-6">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="font-display text-lg font-semibold">{address ? "Edit address" : "New address"}</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 hover:bg-muted" aria-label="Close"><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Delivery address details</Dialog.Description>
          <form onSubmit={submit} noValidate className="space-y-4">
            {formError && <FormAlert>{formError}</FormAlert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="fullName" autoComplete="name" defaultValue={address?.fullName} error={errors.fullName} />
              <Field label="Mobile" name="phone" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" defaultValue={address?.phone.replace(/^\+91/, "")} error={errors.phone} />
            </div>
            <Field label="Flat / house no., building, street" name="line1" autoComplete="address-line1" defaultValue={address?.line1} error={errors.line1} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Area / locality (optional)" name="line2" autoComplete="address-line2" defaultValue={address?.line2 ?? ""} />
              <Field label="Landmark (optional)" name="landmark" defaultValue={address?.landmark ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="City" name="city" autoComplete="address-level2" defaultValue={address?.city} error={errors.city} />
              <div className="space-y-1.5">
                <label htmlFor="state" className="block text-sm font-medium">State</label>
                <select id="state" name="state" defaultValue={address?.state ?? ""} autoComplete="address-level1" className={`h-11 w-full rounded-lg border bg-white px-3 text-sm ${errors.state ? "border-destructive" : "border-input"}`}>
                  <option value="" disabled>Choose…</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
              </div>
              <Field label="PIN code" name="postalCode" inputMode="numeric" maxLength={6} autoComplete="postal-code" defaultValue={address?.postalCode} error={errors.postalCode} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Label (optional)" name="label" placeholder="Home, Office…" defaultValue={address?.label ?? ""} />
              <label className="flex items-center gap-2.5 self-end pb-3 text-sm">
                <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault} className="h-4 w-4 accent-primary" /> Use as my default address
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-11 rounded-lg border border-input px-5 text-sm font-semibold">Cancel</button>
              <button type="submit" disabled={busy} className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
                {busy ? "Saving…" : "Save address"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
