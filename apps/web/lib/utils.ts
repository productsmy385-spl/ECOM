import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Builds a /shop URL from the current params plus overrides (undefined/"" removes a key). */
export function shopHref(current: Record<string, string | undefined>, overrides: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...overrides })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/shop?${s}` : "/shop";
}

/** ImageKit transformation (resize + quality) for a given display width. */
export function ik(url: string, width: number): string {
  if (!url.includes("ik.imagekit.io")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}tr=w-${width},q-80`;
}
