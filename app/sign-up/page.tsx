import { redirect } from "next/navigation";

import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";

import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
  const user = await resolveCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-sm rounded-2xl border p-8 shadow-sm">
        <h1 className="text-foreground text-xl font-semibold">Create your account</h1>
        <p className="text-muted mt-1 text-sm">Start learning English today — free.</p>
        <div className="mt-6">
          <SignUpForm />
        </div>
      </div>
    </main>
  );
}
