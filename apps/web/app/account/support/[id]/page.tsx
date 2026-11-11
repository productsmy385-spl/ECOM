import { getMyTicket, NotFoundError, TICKET_STATUS_LABEL } from "@ecom/services";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/customer";
import { TICKET_TONE } from "../ticket-tone";
import { TicketThread } from "./ticket-thread";

export const metadata: Metadata = { title: "Support request", robots: { index: false } };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await requireCustomer(`/account/support/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let t;
  try {
    t = await getMyTicket(c, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  return (
    <section className="space-y-4" aria-labelledby="ticket-h">
      <Link href="/account/support" className="text-sm text-muted-foreground hover:text-foreground">
        ← Help &amp; support
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="ticket-h" className="font-display text-lg font-semibold">
            {t.subject}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t.ticketNumber}
            {t.order && (
              <>
                {" · "}
                <Link href={`/orders/${t.order.orderNumber}`} className="text-link hover:underline">
                  {t.order.orderNumber}
                </Link>
              </>
            )}
          </p>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${TICKET_TONE[t.status] ?? ""}`}>{TICKET_STATUS_LABEL[t.status]}</span>
      </div>
      <TicketThread id={t.id} initial={JSON.parse(JSON.stringify(t.messages))} closed={t.status === "closed"} />
    </section>
  );
}
