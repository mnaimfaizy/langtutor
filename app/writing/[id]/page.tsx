import { PromptView } from "./prompt-view";

export const metadata = { title: "Writing Prompt — Lang-Tutor" };

export default async function PromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PromptView id={Number(id)} />;
}
