"use client";

import { Loader2, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type State = {
  orderItemId: string | null;
  review: { rating: number; title: string | null; body: string | null; status: "pending" | "approved" | "rejected" } | null;
};

const STATUS: Record<NonNullable<State["review"]>["status"], string> = {
  pending: "Thanks! Your review is waiting for a quick check before it appears.",
  approved: "Your review is live. You can update it any time.",
  rejected: "Your review wasn't published. Please keep reviews about the product and try again.",
};

/** Verified buyers rate and review here; others see why they can't yet. */
export function ReviewForm({ productId, signedIn, initial, loginHref }: { productId: string; signedIn: boolean; initial: State | null; loginHref: string }) {
  const [state, setState] = useState(initial);
  const [editing, setEditing] = useState(!initial?.review);
  const [rating, setRating] = useState(initial?.review?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState(initial?.review?.title ?? "");
  const [body, setBody] = useState(initial?.review?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const box = "mt-6 scroll-mt-32 rounded-xl border border-border p-5";
  if (!signedIn) {
    return (
      <div id="write-review" className={box}>
        <p className="text-sm">Bought this?</p>
        <Link href={loginHref} className="mt-1 inline-block text-sm font-semibold text-link hover:underline">
          Sign in to write a review
        </Link>
      </div>
    );
  }
  if (!state?.orderItemId) {
    return (
      <p id="write-review" className={`${box} text-sm text-muted-foreground`}>
        You can review this product after an order containing it has been delivered.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError("Choose a star rating.");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/account/reviews/${productId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, title, body }) }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as State & { error?: string; fieldErrors?: Record<string, string[]> };
    setBusy(false);
    if (!res?.ok) return setError(json.fieldErrors ? Object.values(json.fieldErrors).flat()[0] ?? json.error ?? "Couldn't save." : json.error ?? "Couldn't save your review.");
    setState(json);
    setEditing(false);
  }

  if (!editing && state.review) {
    return (
      <div id="write-review" className={box}>
        <p className="text-sm font-semibold">Your review</p>
        <p className="mt-1 flex text-primary" aria-label={`${state.review.rating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className="h-4 w-4" fill={n <= state.review!.rating ? "currentColor" : "none"} aria-hidden="true" />
          ))}
        </p>
        <p role="status" className="mt-2 text-sm text-muted-foreground">{STATUS[state.review.status]}</p>
        <button type="button" onClick={() => setEditing(true)} className="mt-2 text-sm font-semibold text-link hover:underline">
          Edit review
        </button>
      </div>
    );
  }

  const field = "mt-1 block w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none";
  return (
    <form id="write-review" onSubmit={submit} className={`${box} space-y-3`}>
      <p className="font-display font-semibold">Rate &amp; review</p>
      <fieldset>
        <legend className="text-sm">Your rating</legend>
        <div className="mt-1 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer text-primary" onMouseEnter={() => setHover(n)}>
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
              <Star className="h-7 w-7" fill={n <= (hover || rating) ? "currentColor" : "none"} aria-hidden="true" />
              <span className="sr-only">{n} star{n > 1 ? "s" : ""}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        Title (optional)
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} placeholder="Sum it up in a few words" />
      </label>
      <label className="block text-sm">
        Review
        <textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={10} maxLength={2000} rows={4} className={field} placeholder="How's the quality, the finish, the packaging?" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-pill px-6 py-2.5">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Submit review
      </button>
    </form>
  );
}
