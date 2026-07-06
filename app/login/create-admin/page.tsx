import { redirect } from "next/navigation";

import { getAuthProvider } from "@/lib/auth/server";
import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { env } from "@/lib/config/env";

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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-sm rounded-2xl border p-8 shadow-sm">
        <h1 className="text-foreground text-xl font-semibold">Create admin account</h1>
        <p className="text-muted mt-1 text-sm">
          No accounts exist yet. Set up the admin account to get started — this can only be done
          once.
        </p>
        <div className="mt-6">
          <CreateAdminForm />
        </div>
      </div>
    </main>
  );
}
