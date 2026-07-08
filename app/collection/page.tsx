import { CollectionScreen } from "./collection-screen";

export const metadata = { title: "Collection — Lang-Tutor" };

export default function CollectionPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-4xl">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          Collection
        </h1>
        <p className="text-muted mt-2 max-w-2xl text-base leading-7">
          Creatures earned from the learning path and achievements from your progress — all in one
          place.
        </p>
        <div className="mt-6">
          <CollectionScreen />
        </div>
      </div>
    </main>
  );
}
