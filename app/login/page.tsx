import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthProvider } from "@/lib/auth/server";
import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { env } from "@/lib/config/env";
import { Card, CardDescription, CardTitle } from "@/ui";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await resolveCurrentUser();
  if (user) redirect("/home");

  if (env.LANGTUTOR_MODE === "local") {
    try {
      const existing = await getAuthProvider().listUsers();
      if (existing.length === 0) redirect("/login/create-admin");
    } catch (error) {
      console.error("[login/page] Failed to check existing users", error);
    }
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="from-gradient-from via-gradient-via to-gradient-to pointer-events-none absolute top-1/2 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br opacity-[0.12] blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <Card variant="glass" className="p-8">
          <CardTitle className="text-xl">Sign in to Lang-Tutor</CardTitle>
          <CardDescription>Enter your credentials to continue.</CardDescription>
          <div className="mt-6">
            <LoginForm />
          </div>
        </Card>
        <p className="text-muted mt-4 text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-accent font-medium underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
