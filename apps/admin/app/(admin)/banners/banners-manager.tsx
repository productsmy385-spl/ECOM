"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import { ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Placement = "hero" | "promo" | "category";
type Banner = {
  id: string;
  placement: Placement;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  isActive: boolean;
  state: "live" | "scheduled" | "ended" | "off";
};

type Draft = { placement: Placement; title: string; subtitle: string; ctaLabel: string; ctaHref: string; imageUrl: string; mobileImageUrl: string; startsAt: string; endsAt: string; sortOrder: string; isActive: boolean };

const PLACEMENT: Record<Placement, string> = { hero: "Home hero slide", promo: "Offer banner", category: "Category banner" };
const STATE: Record<Banner["state"], { label: string; variant: "success" | "info" | "secondary" | "warning" }> = {
  live: { label: "Live", variant: "success" },
  scheduled: { label: "Scheduled", variant: "info" },
  ended: { label: "Ended", variant: "secondary" },
  off: { label: "Off", variant: "warning" },
};

/** ISO → value for <input type="datetime-local"> in the viewer's time zone. */
function toLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

const empty: Draft = { placement: "hero", title: "", subtitle: "", ctaLabel: "Shop collection", ctaHref: "/shop", imageUrl: "", mobileImageUrl: "", startsAt: "", endsAt: "", sortOrder: "0", isActive: true };

export function BannersManager({ initial }: { initial: Banner[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const open = (b?: Banner) => {
    setIssues({});
    setEditing(
      b
        ? {
            id: b.id,
            draft: {
              placement: b.placement,
              title: b.title,
              subtitle: b.subtitle ?? "",
              ctaLabel: b.ctaLabel ?? "",
              ctaHref: b.ctaHref ?? "",
              imageUrl: b.imageUrl ?? "",
              mobileImageUrl: b.mobileImageUrl ?? "",
              startsAt: toLocal(b.startsAt),
              endsAt: toLocal(b.endsAt),
              sortOrder: String(b.sortOrder),
              isActive: b.isActive,
            },
          }
        : { id: null, draft: { ...empty } },
    );
  };
  const set = (k: keyof Draft, v: string | boolean) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, [k]: v } } : e));

  async function reload() {
    setItems(await api<Banner[]>("/banners"));
  }

  async function save() {
    if (!editing) return;
    const d = editing.draft;
    setBusy(true);
    setIssues({});
    try {
      const body = { ...d, sortOrder: Number(d.sortOrder || 0), startsAt: fromLocal(d.startsAt), endsAt: fromLocal(d.endsAt) };
      if (editing.id) await api(`/banners/${editing.id}`, { method: "PUT", body });
      else await api("/banners", { method: "POST", body });
      toast.success(editing.id ? "Banner updated" : "Banner created");
      setEditing(null);
      await reload();
    } catch (e) {
      if (e instanceof ApiError && e.issues) setIssues(Object.fromEntries(e.issues.map((i) => [i.path, i.message])));
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const groups: Placement[] = ["hero", "promo", "category"];
  const d = editing?.draft;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => open()}>
          <Plus className="h-4 w-4" /> New banner
        </Button>
      </div>

      {items.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No banners yet. The home page builds its hero from your catalogue until you add one.
        </Card>
      )}

      {groups
        .filter((g) => items.some((b) => b.placement === g))
        .map((g) => (
          <Card key={g} className="overflow-hidden p-0">
            <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">{PLACEMENT[g]}s</h2>
            <ul className="divide-y divide-border">
              {items
                .filter((b) => b.placement === g)
                .map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                    <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {b.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.imageUrl.startsWith("https://ik.imagekit.io/") ? `${b.imageUrl}?tr=w-200` : b.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {b.subtitle || "No subtitle"} · Order {b.sortOrder}
                        {b.endsAt && ` · Ends ${new Date(b.endsAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
                      </p>
                    </div>
                    <Badge variant={STATE[b.state].variant}>{STATE[b.state].label}</Badge>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => open(b)} aria-label={`Edit ${b.title}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${b.title}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        }
                        title="Delete this banner?"
                        description={`"${b.title}" will be removed from the storefront. This can't be undone.`}
                        confirmLabel="Delete"
                        destructive
                        onConfirm={async () => {
                          await api(`/banners/${b.id}`, { method: "DELETE" });
                          toast.success("Banner deleted");
                          await reload();
                        }}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          </Card>
        ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && !busy && setEditing(null)}>
        {d && (
          <DialogContent title={editing?.id ? "Edit banner" : "New banner"} className="max-w-2xl">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Where it shows" value={d.placement} onChange={(e) => set("placement", e.target.value)}>
                  <option value="hero">Home hero slide (up to 5)</option>
                  <option value="promo">Offer banner (home page)</option>
                  <option value="category">Category banner</option>
                </Select>
                <Input label="Order" type="number" min={0} max={999} value={d.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} hint="Lower shows first" error={issues.sortOrder} />
              </div>
              <Input label="Title" value={d.title} maxLength={120} onChange={(e) => set("title", e.target.value)} error={issues.title} />
              <Textarea label="Subtitle" rows={2} value={d.subtitle} maxLength={240} onChange={(e) => set("subtitle", e.target.value)} error={issues.subtitle} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Button label" value={d.ctaLabel} maxLength={40} onChange={(e) => set("ctaLabel", e.target.value)} error={issues.ctaLabel} />
                <Input label="Button link" value={d.ctaHref} onChange={(e) => set("ctaHref", e.target.value)} placeholder="/shop?tag=sale" error={issues.ctaHref} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ImageUpload label="Image" folder="/banners" value={d.imageUrl || null} onChange={(img) => set("imageUrl", img?.url ?? "")} />
                <ImageUpload label="Mobile image (optional)" folder="/banners" value={d.mobileImageUrl || null} onChange={(img) => set("mobileImageUrl", img?.url ?? "")} />
              </div>
              {issues.imageUrl && <p className="text-xs text-destructive">{issues.imageUrl}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Starts (optional)" type="datetime-local" value={d.startsAt} onChange={(e) => set("startsAt", e.target.value)} error={issues.startsAt} />
                <Input label="Ends (optional)" type="datetime-local" value={d.endsAt} onChange={(e) => set("endsAt", e.target.value)} hint="Offer banners show a countdown" error={issues.endsAt} />
              </div>
              <Checkbox checked={d.isActive} onChange={(e) => set("isActive", e.currentTarget.checked)} label="Active" />
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={save} isLoading={busy}>
                  {editing?.id ? "Save banner" : "Create banner"}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
