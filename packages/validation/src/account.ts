import { z } from "zod";
import { indianPhone, text } from "./common";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const addressSchema = z.object({
  label: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  fullName: text(120, "Full name"),
  phone: indianPhone,
  line1: text(200, "Address line 1"),
  line2: optional(200),
  landmark: optional(120),
  city: text(80, "City"),
  state: z.enum(INDIAN_STATES, { message: "Choose a state" }),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.input<typeof addressSchema>;

export const profileSchema = z.object({
  name: text(120, "Name"),
  phone: z
    .union([z.literal(""), indianPhone])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  dateOfBirth: z
    .union([z.literal(""), z.iso.date("Use a valid date")])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || new Date(v) < new Date(), "Date of birth must be in the past"),
  marketingOptIn: z.boolean().default(false),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const wishlistSchema = z.object({ productId: z.uuid() });
