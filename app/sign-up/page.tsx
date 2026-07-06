import { redirect } from "next/navigation";

import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { Card, CardDescription, CardTitle } from "@/ui";

import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
  const user = await resolveCurrentUser();
  if (user) redirect("/home");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="from-gradient-from via-gradient-via to-gradient-to pointer-events-none absolute top-1/2 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br opacity-[0.12] blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <Card variant="glass" className="p-8">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Start learning English today — free.</CardDescription>
          <div className="mt-6">
            <SignUpForm />
          </div>
        </Card>
      </div>
    </main>
  );
}
