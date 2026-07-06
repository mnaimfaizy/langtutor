import { Card } from "@/ui";
import { BookIcon, HeadphonesIcon, MicIcon, PencilIcon } from "./icons";

const skills = [
  {
    name: "Reading",
    blurb: "Level-appropriate passages with tap-to-define, from A1 to C2.",
    icon: BookIcon,
  },
  {
    name: "Writing",
    blurb: "Guided prompts with structured, corrective AI feedback.",
    icon: PencilIcon,
  },
  {
    name: "Listening",
    blurb: "Dictation and comprehension drills with natural text-to-speech.",
    icon: HeadphonesIcon,
  },
  {
    name: "Speaking",
    blurb: "Pronunciation practice scored by on-device transcription.",
    icon: MicIcon,
  },
];

export function MarketingSkillsSection() {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="marketing-skills-heading">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="marketing-skills-heading"
            className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Four skills, one adaptive tutor
          </h2>
          <p className="text-muted mt-3 text-lg leading-8">
            Every module targets a different way of using English — all tuned to your level and weak
            spots.
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {skills.map(({ name, blurb, icon: Icon }) => (
            <li key={name}>
              <Card className="h-full text-center sm:text-left">
                <span className="from-gradient-from via-gradient-via to-gradient-to text-gradient-foreground mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm sm:mx-0">
                  <Icon className="size-6" />
                </span>
                <h3 className="text-foreground mt-4 text-base font-semibold">{name}</h3>
                <p className="text-muted mt-1.5 text-sm leading-6">{blurb}</p>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
