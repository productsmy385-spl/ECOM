import { isPermission, type Permission } from "@ecom/rbac";
import { z } from "zod";
import { optionalText, text } from "./common";

export const roleCreateSchema = z.object({
  name: text(60, "Role name"),
  description: optionalText(240),
});
export type RoleCreateInput = z.input<typeof roleCreateSchema>;

export const roleUpdateSchema = roleCreateSchema;
export type RoleUpdateInput = z.input<typeof roleUpdateSchema>;

export const rolePermissionsSchema = z.object({
  permissions: z
    .array(z.string())
    .max(200)
    .refine((list) => list.every(isPermission), "Unknown permission")
    .transform((list) => [...new Set(list)] as Permission[]),
});
