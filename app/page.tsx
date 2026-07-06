import Link from "next/link";
import { redirect } from "next/navigation";

import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { resolveRootRedirect } from "@/lib/auth/root-route";
import { buttonClassName } from "@/ui";

/**
 * Public marketing root. Anonymous visitors see this stub shell; authenticated
 * visitors are sent straight to the learning home (see `resolveRootRedirect`).
 */
export default async function MarketingPage() {
  const user = await resolveCurrentUser();
  const redirectTo = resolveRootRedirect(user);
  if (redirectTo) redirect(redirectTo);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <div className="w-full max-w-lg">
        <h1 className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Lang-Tutor
        </h1>
        <p className="text-muted mt-4 text-lg leading-8">
          A private, local-first English tutor — reading, writing, listening, and speaking, adaptive
          and gamified.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/sign-up"
            data-testid="btn-marketing-sign-up"
            className={buttonClassName({ variant: "gradient", size: "lg" })}
          >
            Sign up
          </Link>
          <Link
            href="/login"
            data-testid="btn-marketing-login"
            className={buttonClassName({ variant: "secondary", size: "lg" })}
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
