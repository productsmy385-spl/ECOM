import type { Metadata } from "next";
import { AuthPanel } from "../auth-panel";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthPanel title="Reset your password" subtitle="We'll email you a single-use link to choose a new password.">
      <ForgotForm />
    </AuthPanel>
  );
}
