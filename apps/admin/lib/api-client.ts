"use client";

/** Error thrown for non-2xx API responses; carries per-field messages for forms. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Same-origin JSON fetch against the admin API (basePath /admin).
 * A 401 means the session ended (expired, revoked or deactivated) → back to login.
 */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/admin/api${path}`, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string[]> };
  if (res.status === 401 && typeof window !== "undefined") {
    // Deliberate full reload (not router.push): this runs outside React, and a
    // revoked session should also discard all cached client state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/admin/login");
  }
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Request failed.", data.fieldErrors);
  return data as T;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
