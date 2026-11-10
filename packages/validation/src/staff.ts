import { z } from "zod";
import { email, optionalPhone, optionalText, pagination, text, uuid } from "./common";

const roleIds = z.array(uuid).min(1, "Select at least one role").max(20);

export const staffCreateSchema = z.object({
  name: text(120, "Name"),
  email,
  phone: optionalPhone,
  designation: optionalText(80),
  employeeCode: optionalText(32),
  roleIds,
});
export type StaffCreateInput = z.input<typeof staffCreateSchema>;

export const staffUpdateSchema = z.object({
  name: text(120, "Name"),
  phone: optionalPhone,
  designation: optionalText(80),
  employeeCode: optionalText(32),
  roleIds,
});
export type StaffUpdateInput = z.input<typeof staffUpdateSchema>;

export const staffStatusSchema = z.object({ active: z.boolean() });

export const staffListQuery = pagination.extend({
  q: z.string().trim().max(100).optional(),
  role: z.string().trim().max(64).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});
export type StaffListQuery = z.infer<typeof staffListQuery>;
