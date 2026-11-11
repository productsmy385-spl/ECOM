"use client";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export class UploadError extends Error {
  constructor(message: string, readonly unavailable = false) {
    super(message);
  }
}

/** Uploads a customer image to ImageKit with a short-lived server signature. */
export async function uploadDesignImage(file: File): Promise<{ url: string; width: number; height: number }> {
  if (!IMAGE_TYPES.includes(file.type)) throw new UploadError("Use a JPG, PNG or WebP image.");
  if (file.size > MAX_BYTES) throw new UploadError("Images must be 5 MB or smaller.");
  const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => reject(new UploadError("That file isn't a readable image."));
    img.src = url;
  });

  const authRes = await fetch("/api/uploads/design-auth", { cache: "no-store" });
  if (authRes.status === 503) throw new UploadError("Image uploads aren't available yet. You can still add text.", true);
  if (!authRes.ok) throw new UploadError(authRes.status === 429 ? "Too many uploads. Wait a minute and try again." : "Couldn't start the upload.");
  const auth = (await authRes.json()) as { token: string; expire: number; signature: string; publicKey: string; folder: string };

  const form = new FormData();
  form.append("file", file);
  form.append("fileName", file.name.replace(/[^\w.-]+/g, "-").slice(0, 60));
  form.append("publicKey", auth.publicKey);
  form.append("signature", auth.signature);
  form.append("expire", String(auth.expire));
  form.append("token", auth.token);
  form.append("folder", auth.folder);
  form.append("useUniqueFileName", "true");
  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
  if (!res.ok || !data.url) throw new UploadError(data.message ?? "Upload failed. Please try again.");
  return { url: data.url, ...dims };
}
