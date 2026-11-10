"use client";

import { ApiError } from "@/lib/api-client";
import { ACCEPTED_TYPES, ikThumb, type UploadedImage, uploadToImageKit } from "@/lib/imagekit-upload";
import { cn } from "@/lib/utils";
import { ImageOff, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";

interface ImageUploadProps {
  label: string;
  value: string | null;
  onChange: (image: UploadedImage | null) => void;
  folder: string;
  className?: string;
  disabled?: boolean;
}

/** Single-image picker backed by signed ImageKit uploads. */
export function ImageUpload({ label, value, onChange, folder, className, disabled }: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadToImageKit(file, folder));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 503 ? "Image uploads aren't configured yet (ImageKit keys missing)." : (err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail from ImageKit
            <img src={ikThumb(value)} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {value ? "Replace" : "Upload"}
          </button>
          {value && !disabled && (
            <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
              <X className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          aria-label={label}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG, WebP or AVIF · up to 5 MB</p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
