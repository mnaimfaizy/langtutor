"use client";

import { LogoutIcon } from "./icons";
import { Button } from "@/ui";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void handleLogout()}
      aria-label="Sign out"
      className="gap-1.5 px-2.5 sm:px-3"
    >
      <LogoutIcon className="size-4" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
