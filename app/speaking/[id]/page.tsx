import { SpeakingView } from "./speaking-view";

export default async function SpeakingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SpeakingView id={Number(id)} />;
}
