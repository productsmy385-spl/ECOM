import { AdiraLoader } from "@ecom/ui/loader";

/** Shown while an admin page streams in during navigation: the animated Adira logo. */
export default function AdminLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <AdiraLoader size={76} label="Loading page" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
