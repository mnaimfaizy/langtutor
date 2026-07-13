import { requireAdmin } from "@/lib/auth/guards";

import { listSharedPathCatalog } from "./actions";
import { SharedPathReviewClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AdminSharedPathPage() {
  await requireAdmin();
  const snapshot = await listSharedPathCatalog();
  return (
    <SharedPathReviewClient
      initialPending={snapshot.pending}
      initialApproved={snapshot.approved}
      initialRejected={snapshot.rejected}
      initialStages={snapshot.stages}
    />
  );
}
