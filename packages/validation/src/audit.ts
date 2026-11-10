import { z } from "zod";
import { pagination } from "./common";

export const auditListQuery = pagination.extend({
  entityType: z.string().trim().max(40).optional(),
  action: z.string().trim().max(80).optional(),
  actorId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AuditListQuery = z.infer<typeof auditListQuery>;
