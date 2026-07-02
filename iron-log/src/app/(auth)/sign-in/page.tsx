import { AuthForm } from "@/components/auth-form";
import { SetupNotice } from "@/components/setup-notice";
import { hasEnvVars } from "@/lib/utils";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  if (!hasEnvVars) return <SetupNotice />;
  return <AuthForm mode="sign-in" initialMessage={message} />;
}
