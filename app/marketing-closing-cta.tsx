import Link from "next/link";

import { buttonClassName } from "@/ui";

export function MarketingClosingCta() {
  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24">
      <div
        aria-hidden
        className="from-gradient-from via-gradient-via to-gradient-to pointer-events-none absolute top-1/2 left-1/2 h-[24rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br opacity-[0.12] blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-2xl text-center">
        <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          Start learning today — free
        </h2>
        <p className="text-muted mt-3 text-lg leading-8">
          Create an account and take a two-minute placement quiz to get a level and a plan built
          around your weak spots.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/sign-up"
            data-testid="btn-marketing-sign-up-footer"
            className={buttonClassName({ variant: "gradient", size: "lg" })}
          >
            Sign up free
          </Link>
        </div>
      </div>
    </section>
  );
}
