import Link from "next/link";

import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { LogoutButton } from "./logout-button";

export async function HeaderAuth() {
  const user = await resolveCurrentUser();
  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-muted text-sm" data-testid="header-user-email">
        {user.email}
      </span>
      {user.role === "admin" && (
        <Link
          href="/admin/users"
          className="text-muted hover:text-foreground text-sm"
          data-testid="header-admin-link"
        >
          Admin
        </Link>
      )}
      <LogoutButton />
    </div>
  );
}
