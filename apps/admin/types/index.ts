export type { NavGroup, NavItem } from "@/config/navigation";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

/** The signed-in staff member, as passed from server layout to client shell. */
export interface StaffUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  roles: string[];
  roleNames: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}
