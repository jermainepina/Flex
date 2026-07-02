import { AuthForm } from "@/components/auth-form";
import { SetupNotice } from "@/components/setup-notice";
import { hasEnvVars } from "@/lib/utils";

export default function SignUpPage() {
  if (!hasEnvVars) return <SetupNotice />;
  return <AuthForm mode="sign-up" />;
}
