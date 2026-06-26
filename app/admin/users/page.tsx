import { requireAdmin } from "@/lib/auth/guards";
import { getAuthProvider } from "@/lib/auth/server";

import { UsersClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await getAuthProvider().listUsers();
  return <UsersClient initialUsers={users} />;
}
