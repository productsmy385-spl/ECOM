import { filterNavigation, navigation } from "@/config/navigation";
import { getAdminAuthState } from "@/lib/session";
import { redirect } from "next/navigation";

/** Send each staff member to the first module they can use (e.g. captains have no dashboard). */
export default async function AdminIndex() {
  const state = await getAdminAuthState();
  if (state.kind === "signed-out") redirect("/login");
  if (state.kind === "no-access") redirect("/no-access");
  const { user } = state.session;
  const nav = filterNavigation(navigation, new Set(user.permissions), user.isSuperAdmin);
  redirect(nav[0]?.items[0]?.href ?? "/forbidden");
}
