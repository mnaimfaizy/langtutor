import "server-only";

import type { ContentRepository } from "@/lib/db/content-repository";
import type { ExperienceMode } from "@/lib/db/schema";

import type { AuthProvider, AuthUser } from "./auth-provider";

export interface SignUpWithModeInput {
  email: string;
  password: string;
  experienceMode: ExperienceMode;
}

export interface SignUpWithModeResult {
  sessionId: string;
  user: AuthUser;
}

/**
 * Orchestrates account creation + experience-mode capture (ADR 0014 / issue #55) as one
 * atomic-from-the-caller's-perspective step: create the account via {@link AuthProvider},
 * then write the chosen mode onto the brand-new profile via {@link ContentRepository}.
 *
 * The repository can only be constructed **after** sign-up returns the new user's id
 * (it doesn't exist yet beforehand), so `getRepository` is a factory rather than an
 * instance — this also keeps the function unit-testable against fakes for both seams.
 */
export async function signUpWithExperienceMode(
  { email, password, experienceMode }: SignUpWithModeInput,
  authProvider: AuthProvider,
  getRepository: (userId: string) => ContentRepository | Promise<ContentRepository>,
): Promise<SignUpWithModeResult> {
  const result = await authProvider.signUp(email, password);
  const repository = await getRepository(result.user.id);

  await repository.saveProfile({
    goals: [],
    createdAt: new Date(),
    settings: {},
    experienceMode,
  });

  return result;
}
