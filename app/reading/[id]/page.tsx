import { PassageView } from "./passage-view";

export const metadata = { title: "Passage — Lang-Tutor" };

export default async function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PassageView id={Number(id)} />;
}
