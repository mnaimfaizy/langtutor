"use client";

import { useState } from "react";

import type { AuthUser, UserRole } from "@/lib/auth/auth-provider";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  cn,
} from "@/ui";

import { createUser, deleteUser } from "./actions";

type Banner = { tone: "ok" | "error"; text: string } | null;

export function UsersClient({ initialUsers }: { initialUsers: AuthUser[] }) {
  const [users, setUsers] = useState<AuthUser[]>(initialUsers);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("standard");
  const [creating, setCreating] = useState(false);
  const [createBanner, setCreateBanner] = useState<Banner>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBanner, setDeleteBanner] = useState<Banner>(null);
  const [confirmTarget, setConfirmTarget] = useState<AuthUser | null>(null);

  async function handleCreate() {
    setCreating(true);
    setCreateBanner(null);
    try {
      const newUser = await createUser(email.trim(), password, role);
      setUsers((prev) => [...prev, newUser]);
      setEmail("");
      setPassword("");
      setRole("standard");
      setCreateBanner({ tone: "ok", text: `User ${newUser.email} created.` });
    } catch (err) {
      setCreateBanner({
        tone: "error",
        text: err instanceof Error ? err.message : "Create failed",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(userId: string) {
    setDeletingId(userId);
    setDeleteBanner(null);
    setConfirmTarget(null);
    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      // Guard against ZodError JSON or other non-human strings leaking into the UI.
      const safe = raw && raw.length < 200 && !raw.startsWith("[") ? raw : "Delete failed.";
      setDeleteBanner({ tone: "error", text: safe });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="text-foreground text-2xl font-semibold">User management</h1>
      <p className="text-muted mt-1 text-sm">Admin-only. Create and manage user accounts.</p>

      <Card className="mt-6">
        <CardTitle>Users</CardTitle>
        <CardDescription>All registered accounts and their roles.</CardDescription>
        <CardContent>
          {deleteBanner && (
            <p
              className={cn(
                "mb-3 text-sm",
                deleteBanner.tone === "ok" ? "text-success" : "text-danger",
              )}
              role="status"
            >
              {deleteBanner.text}
            </p>
          )}
          {users.length === 0 ? (
            <p className="text-muted text-sm">No users found.</p>
          ) : (
            <ul className="divide-border divide-y">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <span className="text-foreground text-sm font-medium">{u.email}</span>
                    <span
                      className={cn(
                        "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
                        u.role === "admin"
                          ? "bg-accent/10 text-accent"
                          : "bg-foreground/5 text-muted",
                      )}
                    >
                      {u.role}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirmTarget(u)}
                    disabled={deletingId === u.id}
                    aria-label={`Delete ${u.email}`}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Delete user?</DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{confirmTarget?.email}</strong> will be permanently
            removed and will no longer be able to sign in. This cannot be undone.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-3">
            <DialogClose>Cancel</DialogClose>
            <Button
              variant="secondary"
              onClick={() => confirmTarget && void handleDelete(confirmTarget.id)}
              disabled={deletingId !== null}
              className="bg-danger/10 text-danger hover:bg-danger/20 border-danger/30"
            >
              {deletingId ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="mt-6">
        <CardTitle>Create user</CardTitle>
        <CardDescription>
          Add a new account. The user can change their password after signing in.
        </CardDescription>
        <CardContent className="space-y-4">
          <label className="block">
            <span className="text-foreground text-sm font-medium">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={creating}
              autoComplete="off"
              className="mt-1.5"
            />
          </label>
          <label className="block">
            <span className="text-foreground text-sm font-medium">Initial password</span>
            <span className="text-muted mt-0.5 block text-xs">Minimum 8 characters</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={creating}
              autoComplete="new-password"
              className="mt-1.5"
            />
          </label>
          <label className="block">
            <span className="text-foreground text-sm font-medium">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={creating}
              className="border-border bg-background text-foreground mt-1.5 block w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="standard">Standard</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <div className="pt-1">
            <Button
              onClick={() => void handleCreate()}
              disabled={creating || !email.trim() || !password}
            >
              Create user
            </Button>
          </div>
          {createBanner && (
            <p
              className={cn("text-sm", createBanner.tone === "ok" ? "text-success" : "text-danger")}
              role="status"
            >
              {createBanner.text}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
