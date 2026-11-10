import { getStaffSession } from "@/lib/session";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "../auth-panel";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getStaffSession()) redirect("/dashboard");
  return (
    <AuthPanel title="Staff sign in" subtitle="Use the email your administrator registered for you.">
      <LoginForm />
    </AuthPanel>
  );
}
