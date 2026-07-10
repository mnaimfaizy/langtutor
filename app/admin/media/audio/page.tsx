import { requireAdmin } from "@/lib/auth/guards";

import { listAudioMediaAssets } from "./actions";
import { AudioReviewClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminAudioMediaPage() {
  await requireAdmin();
  const [pending, approved] = await Promise.all([
    listAudioMediaAssets("pending"),
    listAudioMediaAssets("approved"),
  ]);
  return <AudioReviewClient initialPending={pending} initialApproved={approved} />;
}
