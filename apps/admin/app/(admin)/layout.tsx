import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { SIDEBAR_COOKIE, ShellProvider } from "@/components/layout/shell-context";
import { Sidebar } from "@/components/layout/sidebar";
import { requireStaff } from "@/lib/session";
import { cookies } from "next/headers";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireStaff();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <ShellProvider user={user} initialCollapsed={collapsed}>
      <div className="relative flex h-dvh overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <main className="relative flex-1 overflow-y-auto p-4 lg:p-6">
            <div className="mx-auto w-full max-w-[1440px]">
              {children}
              <Footer />
            </div>
          </main>
        </div>
      </div>
    </ShellProvider>
  );
}
