import { listMyTickets, TICKET_STATUS_LABEL } from "@ecom/services";
import { formatDateIN } from "@ecom/ui/format";
import { LifeBuoy, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomer } from "@/lib/customer";
import { TICKET_TONE } from "./ticket-tone";

export const metadata: Metadata = { title: "Help & support", robots: { index: false } };


export default async function SupportPage() {
  const c = await requireCustomer("/account/support");
  const tickets = await listMyTickets(c);
  return (
    <section className="space-y-4" aria-labelledby="support-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="support-h" className="font-display text-lg font-semibold">
          Help &amp; support
        </h2>
        <Link href="/account/support/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          <Plus className="h-4 w-4" aria-hidden="true" /> New request
        </Link>
      </div>
      {tickets.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <LifeBuoy className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-semibold">No requests yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Questions about an order, a custom design or a refund? Start a request and our team will reply here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/account/support/${t.id}`} className="flex flex-col gap-1 p-4 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.subject}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.ticketNumber} · Updated {formatDateIN(t.updatedAt)}
                  </p>
                </div>
                <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TICKET_TONE[t.status] ?? ""}`}>{TICKET_STATUS_LABEL[t.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
