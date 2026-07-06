import { AddWordForm } from "./add-word-form";

export const metadata = { title: "Deck — Lang-Tutor" };

export default function DeckPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Add words</h1>
          <p className="text-muted mt-1 text-sm">
            Look up a word and add it to your SRS deck for spaced-repetition review.
          </p>
        </div>
        <AddWordForm />
      </div>
    </main>
  );
}
