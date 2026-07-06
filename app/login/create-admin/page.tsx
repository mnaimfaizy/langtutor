import { redirect } from "next/navigation";

import { getAuthProvider } from "@/lib/auth/server";
import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { env } from "@/lib/config/env";
import { Card, CardDescription, CardTitle } from "@/ui";

import { CreateAdminForm } from "../create-admin-form";

export default async function CreateAdminPage() {
  const user = await resolveCurrentUser();
  if (user) redirect("/");

  if (env.LANGTUTOR_MODE === "cloud") {
    redirect("/login");
  }

  try {
    const existing = await getAuthProvider().listUsers();
    if (existing.length > 0) redirect("/login");
  } catch (error) {
    console.error("[login/create-admin/page] Failed to check existing users", error);
    redirect("/login");
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="from-gradient-from via-gradient-via to-gradient-to pointer-events-none absolute top-1/2 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br opacity-[0.12] blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <Card variant="glass" className="p-8">
          <CardTitle className="text-xl">Create admin account</CardTitle>
          <CardDescription>
            No accounts exist yet. Set up the admin account to get started — this can only be done
            once.
          </CardDescription>
          <div className="mt-6">
            <CreateAdminForm />
          </div>
        </Card>
      </div>
    </main>
  );
}
