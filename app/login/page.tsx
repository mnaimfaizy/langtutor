import { redirect } from "next/navigation";

import { getAuthProvider } from "@/lib/auth/server";
import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await resolveCurrentUser();
  if (user) redirect("/");

  const existing = await getAuthProvider().listUsers();
  if (existing.length === 0) redirect("/login/create-admin");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-sm rounded-2xl border p-8 shadow-sm">
        <h1 className="text-foreground text-xl font-semibold">Sign in to Lang-Tutor</h1>
        <p className="text-muted mt-1 text-sm">Enter your credentials to continue.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
