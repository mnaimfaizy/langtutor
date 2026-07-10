import { requireAdmin } from "@/lib/auth/guards";

import { listImageCurriculumGaps, listMediaAssets } from "./actions";
import { MediaReviewClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  await requireAdmin();
  const [pending, approved, curriculumGaps] = await Promise.all([
    listMediaAssets("pending"),
    listMediaAssets("approved"),
    listImageCurriculumGaps(),
  ]);
  return (
    <MediaReviewClient
      initialPending={pending}
      initialApproved={approved}
      initialCurriculumGaps={curriculumGaps}
    />
  );
}
