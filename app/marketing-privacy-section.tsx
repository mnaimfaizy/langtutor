import { ActivityIcon, InstallIcon, ShieldIcon } from "./icons";

const points = [
  {
    title: "Your data stays yours",
    blurb:
      "Learner progress, decks, and history live in your browser's own storage — never uploaded to a third-party server.",
    icon: ShieldIcon,
  },
  {
    title: "AI that runs at home",
    blurb:
      "Chat, feedback, and speech recognition run on your own machine over your own network — not a shared cloud model.",
    icon: ActivityIcon,
  },
  {
    title: "Installable, offline-capable",
    blurb:
      "Add it to your home screen as a PWA and keep practicing reading and vocabulary review with no connection at all.",
    icon: InstallIcon,
  },
];

export function MarketingPrivacySection() {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="marketing-privacy-heading">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="marketing-privacy-heading"
            className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Private by design, not by promise
          </h2>
          <p className="text-muted mt-3 text-lg leading-8">
            Lang-Tutor is local-first: it works without a company in the middle of your learning
            data.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {points.map(({ title, blurb, icon: Icon }) => (
            <div key={title} className="text-center">
              <span className="bg-accent/15 text-accent mx-auto flex size-12 items-center justify-center rounded-2xl">
                <Icon className="size-6" />
              </span>
              <h3 className="text-foreground mt-4 text-base font-semibold">{title}</h3>
              <p className="text-muted mt-1.5 text-sm leading-6">{blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
