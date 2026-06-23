import { DictationView } from "./dictation-view";

export const metadata = { title: "Dictation — Lang-Tutor" };

export default async function DictationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DictationView id={Number(id)} />;
}
