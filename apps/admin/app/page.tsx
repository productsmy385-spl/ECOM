import { filterNavigation, navigation } from "@/config/navigation";
import { getStaffSession } from "@/lib/session";
import { redirect } from "next/navigation";

/** Send each staff member to the first module they can use (e.g. captains have no dashboard). */
export default async function AdminIndex() {
  const s = await getStaffSession();
  if (!s) redirect("/login");
  const nav = filterNavigation(navigation, new Set(s.user.permissions), s.user.isSuperAdmin);
  redirect(nav[0]?.items[0]?.href ?? "/forbidden");
}
