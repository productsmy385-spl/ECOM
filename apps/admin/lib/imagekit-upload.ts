"use client";

import { ApiError, api } from "./api-client";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_BYTES = 5 * 1024 * 1024;

interface AuthParams {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
}

export interface UploadedImage {
  url: string;
  fileId: string;
}

/** Throws ApiError(503) when ImageKit is not configured. */
export async function uploadToImageKit(file: File, folder: string): Promise<UploadedImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new ApiError(422, "Use a JPG, PNG, WebP or AVIF image.");
  if (file.size > MAX_BYTES) throw new ApiError(422, "Images must be 5 MB or smaller.");

  // A fresh signature per file: tokens are single-use on ImageKit's side.
  const auth = await api<AuthParams>("/uploads/imagekit-auth");
  const form = new FormData();
  form.append("file", file);
  form.append("fileName", file.name.replace(/[^\w.-]+/g, "-").slice(0, 80));
  form.append("publicKey", auth.publicKey);
  form.append("signature", auth.signature);
  form.append("expire", String(auth.expire));
  form.append("token", auth.token);
  form.append("folder", folder);
  form.append("useUniqueFileName", "true");

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { url?: string; fileId?: string; message?: string };
  if (!res.ok || !data.url || !data.fileId) throw new ApiError(res.status, data.message ?? "Upload failed. Please try again.");
  return { url: data.url, fileId: data.fileId };
}

/** ImageKit URL transformation for thumbnails (no-op for non-ImageKit URLs). */
export function ikThumb(url: string, w = 160): string {
  return url.includes("ik.imagekit.io") ? `${url}${url.includes("?") ? "&" : "?"}tr=w-${w},q-80` : url;
}
