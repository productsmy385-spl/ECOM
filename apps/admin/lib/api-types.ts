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
  hasJoined: boolean;
  clerkUserId: string | null;
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

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isCustomizable: boolean;
  sortOrder: number;
  productCount: number;
}

export interface AdminBrand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  productCount: number;
}

export interface AdminProductListItem {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  categoryName: string;
  brandName: string | null;
  imageUrl: string | null;
  variantCount: number;
  minPrice: number | null;
  stock: number;
  isCustomizable: boolean;
  updatedAt: string;
}

export interface AdminVariant {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  color: string | null;
  colorHex: string | null;
  size: string | null;
  material: string | null;
  price: number;
  compareAtPrice: number | null;
  weightGrams: number | null;
  isDefault: boolean;
  isActive: boolean;
  onHand: number;
  reserved: number;
  minStock: number;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  categoryId: string;
  brandId: string | null;
  shortDescription: string | null;
  description: string | null;
  isCustomizable: boolean;
  requiresDesignReview: boolean;
  isFeatured: boolean;
  taxRateBps: number;
  hsnCode: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
  variants: AdminVariant[];
  attributes: { groupName: string | null; name: string; value: string; isFilterable: boolean }[];
  images: { id: string; url: string; alt: string | null; imagekitFileId: string | null; variantSku: string | null }[];
}

export interface CatalogOptions {
  categories: { id: string; name: string; parentId: string | null; isCustomizable: boolean }[];
  brands: { id: string; name: string }[];
}

export const rupees = (paise: number | null | undefined) =>
  paise === null || paise === undefined
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);

export const formatDateTime =(iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
