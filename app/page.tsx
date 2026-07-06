import { redirect } from "next/navigation";

import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { resolveRootRedirect } from "@/lib/auth/root-route";
import { MarketingClosingCta } from "./marketing-closing-cta";
import { MarketingHero } from "./marketing-hero";
import { MarketingKidModeSection } from "./marketing-kid-mode-section";
import { MarketingPrivacySection } from "./marketing-privacy-section";
import { MarketingSkillsSection } from "./marketing-skills-section";
import { MarketingSrsSection } from "./marketing-srs-section";

/**
 * Public marketing landing page (ADR 0018). Anonymous visitors see the full pitch —
 * hero, skills, SRS/adaptivity, privacy, and kid-mode sections — carrying the
 * premium-dark brand (ADR 0017). Authenticated visitors are sent straight to the
 * learning home instead (see `resolveRootRedirect`). Fully server-rendered: no
 * client JS, no data fetching, no calls to the Mac.
 */
export default async function MarketingPage() {
  const user = await resolveCurrentUser();
  const redirectTo = resolveRootRedirect(user);
  if (redirectTo) redirect(redirectTo);

  return (
    <main className="flex flex-1 flex-col">
      <MarketingHero />
      <MarketingSkillsSection />
      <MarketingSrsSection />
      <MarketingPrivacySection />
      <MarketingKidModeSection />
      <MarketingClosingCta />
    </main>
  );
}
