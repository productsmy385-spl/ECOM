import { z } from "zod";

export const uuid = z.uuid({ message: "Invalid id" });

/** Trimmed, non-empty text with a max length. */
export const text = (max: number, label = "This field") =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(254));

/** Indian mobile numbers, optionally prefixed with +91. Stored as +91XXXXXXXXXX. */
export const indianPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"))
  .transform((v) => (v.startsWith("+91") ? v : `+91${v}`));

export const optionalPhone = z
  .union([z.literal(""), indianPhone])
  .optional()
  .transform((v) => (v ? v : undefined));

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Use both letters and numbers");

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
