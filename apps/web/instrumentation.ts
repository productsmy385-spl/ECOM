/**
 * Background sweep, started once per storefront server process: cancels
 * Razorpay orders left unpaid past the payment hold and releases their stock.
 *
 * Runs in-process because the storefront is a single Railway replica and Redis
 * isn't provisioned yet (knowledge-base/OPEN_QUESTIONS.md, Phase 6 decisions). The
 * sweep is idempotent and row-locked (SKIP LOCKED), so a second replica would
 * only duplicate harmless work. Never runs during `next build`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL) return;
  const g = globalThis as { __ecomHoldSweep?: NodeJS.Timeout };
  if (g.__ecomHoldSweep) return;

  const { releaseExpiredHolds } = await import("@ecom/services");
  const sweep = async () => {
    try {
      const n = await releaseExpiredHolds();
      if (n) console.log(`[holds] released ${n} unpaid order(s)`);
    } catch (err) {
      console.error("[holds] sweep failed:", (err as Error).message);
    }
  };
  g.__ecomHoldSweep = setInterval(sweep, 5 * 60_000);
  g.__ecomHoldSweep.unref?.();
  setTimeout(sweep, 30_000).unref?.();
}
