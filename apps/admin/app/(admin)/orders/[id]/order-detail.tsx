"use client";

import { PageHeader } from "@/components/layout/page-header";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/api-types";
import type { AdminOrderDetail } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { ORDER_STATUS_LABEL, type OrderStatusValue } from "@ecom/validation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, MapPin, Package, Palette, Printer, RotateCcw, StickyNote, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

type Can = { update: boolean; cancel: boolean; assign: boolean; refund: boolean; designs: boolean; customers: boolean };

function StatusDialog({ order, to, onClose }: { order: AdminOrderDetail; to: OrderStatusValue | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!to) return null;
  const cancel = to === "cancelled";
  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const data = await api<AdminOrderDetail>(`/orders/${order.id}/status`, { method: "POST", body: { status: to, note: note || undefined, notifyCustomer: notify } });
      qc.setQueryData(["order", order.id], data);
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Order moved to ${ORDER_STATUS_LABEL[to!]}`);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={cancel ? `Cancel ${order.orderNumber}?` : `Move to "${ORDER_STATUS_LABEL[to]}"`}>
        <div className="space-y-4">
          {cancel && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm">
              Reserved stock is released and any coupon use is returned.
              {order.refundable > 0 && " The customer has paid: issue a refund afterwards."}
            </p>
          )}
          {to === "shipped" && !order.fulfilled && <p className="rounded-lg bg-info/10 px-3 py-2 text-sm">Shipping takes the items out of stock.</p>}
          {to === "returned" && <p className="rounded-lg bg-info/10 px-3 py-2 text-sm">The items go back into stock. Refund the customer from the payment panel.</p>}
          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}
          <Textarea label={cancel ? "Reason (required)" : "Note (optional)"} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <Checkbox label="Show this update on the customer's order page" checked={notify} onChange={(e) => setNotify(e.currentTarget.checked)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Back
            </Button>
            <Button variant={cancel ? "destructive" : "default"} isLoading={busy} onClick={submit} disabled={cancel && !note.trim()}>
              {cancel ? "Cancel order" : "Update status"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({ order, open, onClose }: { order: AdminOrderDetail; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState((order.refundable / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const data = await api<AdminOrderDetail>(`/orders/${order.id}/refund`, { method: "POST", body: { amount: Math.round(Number(amount) * 100), reason } });
      qc.setQueryData(["order", order.id], data);
      toast.success("Refund issued");
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError && e.fieldErrors ? Object.values(e.fieldErrors)[0]?.[0] ?? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Issue a refund">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Up to <span className="font-semibold text-foreground">{formatPaise(order.refundable)}</span> can be refunded.{" "}
            {order.paymentProvider === "razorpay" ? "The money goes back to the customer's original payment method through Razorpay." : "Cash on delivery: pay the customer yourself; this records the refund."}
          </p>
          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}
          <Input label="Amount (₹)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Textarea label="Reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Back
            </Button>
            <Button isLoading={busy} onClick={submit} disabled={!reason.trim() || !(Number(amount) > 0)}>
              Refund {Number(amount) > 0 ? formatPaise(Math.round(Number(amount) * 100)) : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OrderDetail({ id, can }: { id: string; can: Can }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["order", id], queryFn: () => api<AdminOrderDetail>(`/orders/${id}`) });
  const staff = useQuery({ queryKey: ["order-assignees"], queryFn: () => api<{ id: string; name: string }[]>("/orders/assignees"), enabled: can.assign });
  const [to, setTo] = useState<OrderStatusValue | null>(null);
  const [refund, setRefund] = useState(false);
  const [note, setNote] = useState("");

  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading order…</p>;
  if (q.isError) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const o = q.data;
  const actions = o.allowedNext.filter((s) => (s === "cancelled" ? can.cancel : can.update));

  async function assign(staffId: string) {
    try {
      const data = await api<AdminOrderDetail>(`/orders/${id}/assign`, { method: "POST", body: { staffId: staffId || null } });
      qc.setQueryData(["order", id], data);
      toast.success(staffId ? "Order assigned" : "Assignment removed");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function addNote() {
    try {
      const data = await api<AdminOrderDetail>(`/orders/${id}/notes`, { method: "POST", body: { body: note } });
      qc.setQueryData(["order", id], data);
      setNote("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>
      <PageHeader
        title={o.orderNumber}
        description={`Placed ${formatDateTime(o.placedAt)} · ${o.paymentProvider === "cod" ? "Cash on delivery" : "Paid online"} · ${o.shippingMethod} shipping`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={o.status} />
            <PaymentStatusBadge status={o.paymentStatus} provider={o.paymentProvider} />
            <Button variant="outline" size="sm" onClick={() => window.open(`/admin/orders/${o.id}/invoice`, "_blank")}>
              <FileText className="h-4 w-4" /> Invoice
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`/admin/orders/${o.id}/packing-slip`, "_blank")}>
              <Printer className="h-4 w-4" /> Packing slip
            </Button>
          </div>
        }
      />

      {actions.length > 0 && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <p className="text-sm font-medium">Next step:</p>
          <div className="flex flex-wrap gap-2">
            {actions.map((s) => (
              <Button key={s} size="sm" variant={s === "cancelled" ? "destructive" : "default"} onClick={() => setTo(s)}>
                {s === "cancelled" ? "Cancel order" : ORDER_STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
          {o.designsPending > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-warning sm:ml-auto">
              <Palette className="h-4 w-4" /> {o.designsPending} design{o.designsPending > 1 ? "s" : ""} awaiting approval
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <h2 className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm font-semibold">
              <Package className="h-4 w-4 text-primary" /> Items
            </h2>
            <ul className="divide-y divide-border">
              {o.items.map((i) => (
                <li key={i.id} className="flex gap-4 p-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {i.imageUrl && <img src={i.imageUrl.startsWith("/") ? `/admin${i.imageUrl}` : i.imageUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{i.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.variantName} · {i.sku} · Qty {i.quantity}
                    </p>
                    {i.summary.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{i.summary.map((s) => `${s.label}: ${s.value}`).join(" · ")}</p>}
                    {i.designId && (
                      <p className="mt-1.5 flex items-center gap-2">
                        <Badge variant={i.designStatus === "approved" ? "success" : "warning"}>Design {i.designStatus?.replace(/_/g, " ") ?? "missing"}</Badge>
                        {can.designs && (
                          <Link href={`/designs/${i.designId}`} className="text-xs font-semibold text-link hover:underline">
                            Open design
                          </Link>
                        )}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{formatPaise(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-border px-5 py-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatPaise(o.amounts.subtotal)}</dd></div>
              {o.amounts.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount {o.couponCode && `(${o.couponCode})`}</dt><dd className="tabular-nums">−{formatPaise(o.amounts.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd className="tabular-nums">{o.amounts.shipping ? formatPaise(o.amounts.shipping) : "Free"}</dd></div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatPaise(o.amounts.total)}</dd></div>
              <p className="text-xs text-muted-foreground">Includes {formatPaise(o.amounts.tax)} GST</p>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <StickyNote className="h-4 w-4 text-primary" /> Internal notes
            </h2>
            <p className="text-xs text-muted-foreground">Only staff see these.</p>
            {can.update && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <Textarea label="Add a note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="flex-1" />
                <Button size="sm" onClick={addNote} disabled={!note.trim()}>
                  Add note
                </Button>
              </div>
            )}
            <ul className="mt-4 space-y-3">
              {o.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.author ?? "Staff"} · {formatDateTime(n.at)}
                  </p>
                </li>
              ))}
              {o.notes.length === 0 && <li className="text-sm text-muted-foreground">No notes yet.</li>}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">History</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-border pl-4">
              {o.history.map((h) => (
                <li key={h.id} className="text-sm">
                  <p className="font-medium">
                    {ORDER_STATUS_LABEL[h.to as OrderStatusValue] ?? h.to} {!h.customerVisible && <Badge variant="outline">internal</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(h.at)}
                    {h.actor ? ` · ${h.actor}` : ""}
                    {h.note ? ` · ${h.note}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold">
              <UserRound className="h-4 w-4 text-primary" /> Customer
            </h2>
            <p className="mt-2 font-medium">{o.customer.name}</p>
            <p className="text-muted-foreground">{o.customer.email ?? "—"}</p>
            <p className="text-muted-foreground">{o.customer.phone ?? ""}</p>
            {o.customer.isGuest ? (
              <Badge variant="outline" className="mt-2">Guest checkout</Badge>
            ) : (
              can.customers && o.customer.id && (
                <Link href={`/customers/${o.customer.id}`} className="mt-2 inline-block text-xs font-semibold text-link hover:underline">
                  View customer
                </Link>
              )
            )}
            {o.customerNote && <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-xs">“{o.customerNote}”</p>}
          </Card>

          <Card className="p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4 text-primary" /> Deliver to
            </h2>
            <address className="mt-2 not-italic text-muted-foreground">
              <span className="font-medium text-foreground">{o.shippingAddress.fullName}</span>
              <br />
              {o.shippingAddress.line1}
              {o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ""}
              {o.shippingAddress.landmark ? `, ${o.shippingAddress.landmark}` : ""}
              <br />
              {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.postalCode}
              <br />
              {o.shippingAddress.phone}
            </address>
          </Card>

          {can.assign && (
            <Card className="p-5">
              <Select label="Assigned to" value={o.assignedStaff?.id ?? ""} onChange={(e) => assign(e.target.value)}>
                <option value="">Unassigned</option>
                {(staff.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Card>
          )}

          <Card className="p-5 text-sm">
            <h2 className="font-semibold">Payment</h2>
            {o.payments.map((p) => (
              <div key={p.id} className="mt-3 space-y-1">
                <p className="flex items-center justify-between">
                  <span>{p.provider === "cod" ? "Cash on delivery" : `Razorpay${p.method ? ` · ${p.method}` : ""}`}</span>
                  <PaymentStatusBadge status={p.status} provider={p.provider} />
                </p>
                <p className="text-muted-foreground">
                  {formatPaise(p.amount)}
                  {p.refundedAmount > 0 && ` · ${formatPaise(p.refundedAmount)} refunded`}
                </p>
                {p.razorpayPaymentId && <p className="font-mono text-xs text-muted-foreground">{p.razorpayPaymentId}</p>}
                {p.failureReason && <p className="text-xs text-destructive">{p.failureReason}</p>}
              </div>
            ))}
            {o.refunds.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
                {o.refunds.map((r) => (
                  <li key={r.id}>
                    {formatPaise(r.amount)} · {r.status} · {formatDateTime(r.createdAt)}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {can.refund && o.refundable > 0 && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setRefund(true)}>
                <RotateCcw className="h-4 w-4" /> Refund
              </Button>
            )}
          </Card>
        </div>
      </div>

      {to && <StatusDialog key={to} order={o} to={to} onClose={() => setTo(null)} />}
      {refund && <RefundDialog order={o} open={refund} onClose={() => setRefund(false)} />}
    </div>
  );
}
