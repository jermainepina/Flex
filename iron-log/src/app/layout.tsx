import type { Metadata } from "next";
import { Archivo_Black, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flexx",
  description: "Log gym workouts and track progress over time",
};

// Server-rendered theme class = no flash of the wrong theme.
async function themeClass(): Promise<string> {
  if (!hasEnvVars) return "dark";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "dark";
    const { data } = await supabase.from("profiles").select("theme").maybeSingle();
    if (data?.theme === "light") return "";
    if (data?.theme === "dim") return "dark theme-dim";
  } catch {
    // Fall through to the default when auth/profile lookups fail.
  }
  return "dark";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await themeClass();
  return (
    <html
      lang="en"
      className={`${theme} ${geistSans.variable} ${geistMono.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
