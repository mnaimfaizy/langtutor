import { AddWordForm } from "./add-word-form";

export const metadata = { title: "Deck — Lang-Tutor" };

export default function DeckPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <AddWordForm />
    </main>
  );
}
