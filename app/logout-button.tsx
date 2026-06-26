"use client";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="text-muted hover:text-foreground text-sm transition-colors"
    >
      Sign out
    </button>
  );
}
