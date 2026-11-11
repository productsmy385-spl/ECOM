"use client";

import type { PaymentStart } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { payWithRazorpay } from "@/lib/razorpay-client";

export function PayNow({ orderId, orderToken, autoStart, brand, amount }: { orderId: string; orderToken?: string; autoStart: boolean; brand: string; amount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderToken ? { orderToken } : {}),
    }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as PaymentStart & { error?: string };
    if (!res?.ok) {
      setBusy(false);
      setError(json.error ?? "Couldn't start the payment. Please try again.");
      return;
    }
    try {
      await payWithRazorpay(json, { orderId, orderToken }, brand);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
    router.refresh();
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void pay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className="space-y-1.5">
      <button type="button" onClick={pay} disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60 sm:w-auto">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />} Pay {formatPaise(amount)}
      </button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
