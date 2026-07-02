import { redirect } from "next/navigation";

export default function Home() {
  // The proxy routes authed users to /dashboard and everyone else to /sign-in.
  redirect("/dashboard");
}
