/** JSON shapes returned by the admin API (dates arrive as ISO strings). */

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RoleRef {
  id: string;
  key: string;
  name: string;
}

export interface StaffListItem {
  id: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  designation: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  roles: RoleRef[];
}

export interface StaffDetail extends StaffListItem {
  phone: string | null;
  employeeCode: string | null;
  hasPassword: boolean;
  permissions: string[];
}

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface PermissionGroup {
  module: string;
  permissions: { key: string; description: string }[];
}

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export const formatDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
