import { describe, expect, it } from "vitest";

import { getOnboardingCopy } from "@/lib/onboarding/copy";

describe("getOnboardingCopy — mode-register selection", () => {
  it("defaults to the adult register when no mode is given", () => {
    const copy = getOnboardingCopy(undefined);
    expect(copy.quizStartButton).toBe("Start quiz");
    expect(copy.quizKnownButton).toBe("Know it");
  });

  it("returns the adult register for 'adult'", () => {
    const copy = getOnboardingCopy("adult");
    expect(copy.quizIntroHeading).toBe("Discover your level");
    expect(copy.goalsHeading).toBe("What's your goal?");
  });

  it("returns a distinct kid register for 'kid'", () => {
    const copy = getOnboardingCopy("kid");
    expect(copy.quizIntroHeading).not.toBe("Discover your level");
    expect(copy.quizStartButton).toBe("Let's play!");
    expect(copy.quizKnownButton).toBe("I know it!");
    expect(copy.quizUnknownButton).toBe("Not yet");
    expect(copy.goalsHeading).toBe("What do you want to learn for?");
  });

  it("interpolates the estimated level into the save-button copy for both registers", () => {
    expect(getOnboardingCopy("adult").quizSaveButton("B1")).toBe("Start learning at B1");
    expect(getOnboardingCopy("kid").quizSaveButton("B1")).toBe("Start my adventure at B1!");
  });
});
