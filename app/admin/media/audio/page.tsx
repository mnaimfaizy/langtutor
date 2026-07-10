import { requireAdmin } from "@/lib/auth/guards";

import { listAudioCurriculumGaps, listAudioMediaAssets } from "./actions";
import { AudioReviewClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminAudioMediaPage() {
  await requireAdmin();
  const [pending, approved, curriculumGaps] = await Promise.all([
    listAudioMediaAssets("pending"),
    listAudioMediaAssets("approved"),
    listAudioCurriculumGaps(),
  ]);
  return (
    <AudioReviewClient
      initialPending={pending}
      initialApproved={approved}
      initialCurriculumGaps={curriculumGaps}
    />
  );
}
