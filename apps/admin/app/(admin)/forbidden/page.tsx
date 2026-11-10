import { EmptyState } from "@/components/ui/empty-state";
import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

export const metadata: Metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<ShieldAlert className="h-8 w-8" />}
        title="You don't have access to this page"
        description="Your role doesn't include permission for this module. Ask a Super Admin if you need access."
      />
    </div>
  );
}
