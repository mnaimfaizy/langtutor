import Link from "next/link";

import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { buttonClassName } from "@/ui";
import { LogoutButton } from "./logout-button";

export async function HeaderAuth() {
  const user = await resolveCurrentUser();
  if (!user) return null;

  return (
    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
      <span
        className="text-muted hidden max-w-40 truncate text-sm sm:inline"
        data-testid="header-user-email"
        title={user.email}
      >
        {user.email}
      </span>
      {user.role === "admin" && (
        <Link
          href="/admin/users"
          className={buttonClassName({ variant: "ghost", size: "sm" })}
          data-testid="header-admin-link"
        >
          Admin
        </Link>
      )}
      <LogoutButton />
    </div>
  );
}
