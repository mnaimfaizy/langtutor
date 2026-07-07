import { DEFAULT_EXPERIENCE_MODE, type ExperienceMode } from "@/lib/db";

/**
 * Mode-register copy for the onboarding journey (ADR 0014 / issue #55). Content
 * *difficulty* (CEFR) stays an independent axis — this only changes wording/tone, never
 * the words being tested. Pure data + a pure selector so the register-switching logic is
 * unit-testable without rendering anything.
 */
export interface OnboardingCopy {
  quizIntroHeading: string;
  quizIntroBody: string;
  quizStartButton: string;
  quizUnknownButton: string;
  quizKnownButton: string;
  quizResultEyebrow: string;
  quizLowConfidenceHint: string;
  quizSaveButton: (level: string) => string;
  goalsHeading: string;
  goalsBody: string;
  goalsButton: string;
}

const ADULT_ONBOARDING_COPY: OnboardingCopy = {
  quizIntroHeading: "Discover your level",
  quizIntroBody:
    "We\u2019ll show you words one at a time. Tap \u201cKnow it\u201d if you know the word, or \u201cDon\u2019t know\u201d if you don\u2019t. Be honest \u2014 the quiz works better that way.",
  quizStartButton: "Start quiz",
  quizUnknownButton: "Don't know",
  quizKnownButton: "Know it",
  quizResultEyebrow: "Your estimated level",
  quizLowConfidenceHint: "Some answers seemed inconsistent — your actual level may differ.",
  quizSaveButton: (level) => `Start learning at ${level}`,
  goalsHeading: "What's your goal?",
  goalsBody: "Pick one or more — you can change this later in Settings.",
  goalsButton: "Start learning",
};

const KID_ONBOARDING_COPY: OnboardingCopy = {
  quizIntroHeading: "Let's find your word superpower!",
  quizIntroBody:
    "We\u2019ll show you words one at a time. Tap \u201cI know it!\u201d if you know the word, or \u201cNot yet\u201d if you don\u2019t. It\u2019s not a test \u2014 just be honest so we pick the perfect level for you!",
  quizStartButton: "Let's play!",
  quizUnknownButton: "Not yet",
  quizKnownButton: "I know it!",
  quizResultEyebrow: "You're a word wizard at level",
  quizLowConfidenceHint: "A few answers were tricky — we might adjust this as you learn.",
  quizSaveButton: (level) => `Start my adventure at ${level}!`,
  goalsHeading: "What do you want to learn for?",
  goalsBody: "Pick one or more — you can always change this later!",
  goalsButton: "Let's go!",
};

/** Selects the onboarding copy register for `mode`, defaulting to adult for undefined. */
export function getOnboardingCopy(
  mode: ExperienceMode | undefined = DEFAULT_EXPERIENCE_MODE,
): OnboardingCopy {
  return mode === "kid" ? KID_ONBOARDING_COPY : ADULT_ONBOARDING_COPY;
}
