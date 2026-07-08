import { requireAdmin } from "@/lib/auth/guards";

import { listMediaAssets } from "./actions";
import { MediaReviewClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  await requireAdmin();
  const [pending, approved] = await Promise.all([
    listMediaAssets("pending"),
    listMediaAssets("approved"),
  ]);
  return <MediaReviewClient initialPending={pending} initialApproved={approved} />;
}
