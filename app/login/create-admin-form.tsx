"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateAdminForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to create admin account");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-foreground text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-border bg-background text-foreground placeholder:text-muted rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="admin@example.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-foreground text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-border bg-background text-foreground placeholder:text-muted rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="At least 8 characters"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-accent-foreground h-10 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create admin account"}
      </button>
    </form>
  );
}
