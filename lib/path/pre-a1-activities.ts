/**
 * Pre-A1 activity slot builders — shared by the legacy seeder and the shared path catalog.
 */
import type { UnitActivityRef } from "@/lib/db";

/** Single alphabet activity slot for Alphabet / letters & sounds runway units. */
export function alphabetActivities(): UnitActivityRef[] {
  return [{ skill: "alphabet" }];
}

/** Single phonics activity slot (gentle letters & sounds or Phonics stage). */
export function phonicsActivities(): UnitActivityRef[] {
  return [{ skill: "phonics" }];
}

/** Single picture-match activity slot for the Picture words stage. */
export function pictureMatchActivities(): UnitActivityRef[] {
  return [{ skill: "picture-match" }];
}

/** Single listen-and-tap activity slot for the Listen & tap stage. */
export function listenTapActivities(): UnitActivityRef[] {
  return [{ skill: "listen-tap" }];
}
