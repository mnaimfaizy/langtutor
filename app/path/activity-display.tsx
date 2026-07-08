import type { ActivityKind } from "@/lib/db";
import { BookIcon, HeadphonesIcon, MicIcon, PencilIcon, RepeatIcon } from "../icons";

// Shared "how does an activity kind look" table — the unit view (issue #59) and the home
// path's node markers (issue #62) both need the same skill → label/icon mapping.

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  review: "Vocabulary review",
  reading: "Reading",
  writing: "Writing",
  listening: "Listening",
  speaking: "Speaking",
};

export const ACTIVITY_ICON: Record<ActivityKind, typeof BookIcon> = {
  review: RepeatIcon,
  reading: BookIcon,
  writing: PencilIcon,
  listening: HeadphonesIcon,
  speaking: MicIcon,
};
