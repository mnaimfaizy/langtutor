"use client";

import { useState, type ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Input,
  Mascot,
  type MascotRegister,
  type MascotState,
  PassageLibraryClient,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  ProgressRing,
  Skeleton,
  Stat,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  Tooltip,
  TtsButton,
} from "@/ui";
import { PaletteSwitcher } from "./palette-switcher";

const MASCOT_STATES: MascotState[] = ["idle", "happy", "celebrate", "encourage"];
const MASCOT_REGISTERS: MascotRegister[] = ["kid", "adult"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

function MascotDemo() {
  const [state, setState] = useState<MascotState>("idle");
  const [register, setRegister] = useState<MascotRegister>("kid");

  function cycleState() {
    setState((current) => {
      const index = MASCOT_STATES.indexOf(current);
      return MASCOT_STATES[(index + 1) % MASCOT_STATES.length] ?? "idle";
    });
  }

  function toggleRegister() {
    setRegister((current) => (current === "kid" ? "adult" : "kid"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Mascot data-testid="mascot-preview" state={state} register={register} />
        <div className="space-y-2">
          <p className="text-foreground text-sm font-medium capitalize">
            {register} · {state}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              data-testid="mascot-cycle-state"
              size="sm"
              variant="secondary"
              onClick={cycleState}
            >
              Cycle state
            </Button>
            <Button
              data-testid="mascot-toggle-register"
              size="sm"
              variant="secondary"
              onClick={toggleRegister}
            >
              Toggle register
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {MASCOT_REGISTERS.map((reg) => (
          <div key={reg} className="border-border bg-surface-1 space-y-3 rounded-xl border p-4">
            <p className="text-muted text-xs font-semibold tracking-wide uppercase">
              {reg} register
            </p>
            <div className="flex flex-wrap items-end justify-between gap-3">
              {MASCOT_STATES.map((s) => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <Mascot data-testid={`mascot-${reg}-${s}`} state={s} register={reg} />
                  <span className="text-muted text-[10px] capitalize">{s}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UiGalleryPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <PaletteSwitcher />

      <header className="mb-10">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">UI gallery</h1>
        <p className="text-muted mt-1 text-sm">
          Every wrapper in the <code>ui/</code> layer (Base UI + Tailwind), rendered under all four
          palette token sets. Dev-only preview.
        </p>
      </header>

      <div className="space-y-10">
        <Section title="Surface elevation">
          <div className="bg-surface-1 border-border w-40 rounded-xl border p-4 text-center">
            <p className="text-foreground text-xs font-medium">surface-1</p>
            <p className="text-muted mt-1 text-xs">base card</p>
          </div>
          <div className="bg-surface-2 border-border w-40 rounded-xl border p-4 text-center">
            <p className="text-foreground text-xs font-medium">surface-2</p>
            <p className="text-muted mt-1 text-xs">popover / tooltip</p>
          </div>
          <div className="bg-surface-3 border-border w-40 rounded-xl border p-4 text-center">
            <p className="text-foreground text-xs font-medium">surface-3</p>
            <p className="text-muted mt-1 text-xs">top-most overlay</p>
          </div>
        </Section>

        <Section title="Gradient">
          <div
            data-testid="gradient-sample"
            className="from-gradient-from via-gradient-via to-gradient-to text-gradient-foreground flex h-24 w-full items-center justify-center rounded-xl bg-gradient-to-br"
          >
            <p className="text-sm font-semibold drop-shadow-sm">gradient-from → via → to</p>
          </div>
        </Section>

        <Section title="Glass">
          <div className="from-gradient-from via-gradient-via to-gradient-to relative h-32 w-full overflow-hidden rounded-xl bg-gradient-to-br p-6">
            <div
              data-testid="glass-sample"
              className="bg-glass border-glass-border absolute inset-4 flex items-center justify-center rounded-lg border backdrop-blur-lg"
            >
              <p className="text-foreground text-sm font-medium">translucent surface + blur</p>
            </div>
          </div>
        </Section>

        <Section title="Glow">
          <div
            data-testid="glow-sample"
            className="bg-accent text-accent-foreground shadow-glow rounded-xl px-6 py-4 text-sm font-medium"
          >
            focus / celebration glow
          </div>
        </Section>

        <Section title="Button — variants">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="gradient" data-testid="button-gradient">
            Gradient
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </Section>

        <Section title="Button — sizes">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Section>

        <Section title="Input">
          <Input placeholder="Type a word…" className="max-w-xs" />
        </Section>

        <Section title="Card — variants">
          <Card className="max-w-sm" data-testid="card-surface">
            <CardTitle>Surface</CardTitle>
            <CardDescription>The default opaque card surface.</CardDescription>
            <CardContent>
              <Button size="sm">Action</Button>
            </CardContent>
          </Card>
          <div className="from-gradient-from via-gradient-via to-gradient-to relative max-w-sm flex-1 rounded-xl bg-gradient-to-br p-4">
            <Card variant="glass" className="max-w-none" data-testid="card-glass">
              <CardTitle>Glass</CardTitle>
              <CardDescription>Translucent surface, blurred over a busy backdrop.</CardDescription>
              <CardContent>
                <Button size="sm" variant="gradient">
                  Action
                </Button>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section title="Dialog">
          <Dialog>
            <DialogTrigger>Open dialog</DialogTrigger>
            <DialogContent>
              <DialogTitle>Dialog title</DialogTitle>
              <DialogDescription>
                A Base UI dialog, themed and wrapped behind the ui/ layer.
              </DialogDescription>
              <div className="mt-5 flex justify-end gap-2">
                <DialogClose>Close</DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </Section>

        <Section title="Popover">
          <Popover>
            <PopoverTrigger>Open popover</PopoverTrigger>
            <PopoverContent>
              <p className="text-foreground font-medium">Popover</p>
              <p className="text-muted mt-1">Anchored, dismissable content.</p>
            </PopoverContent>
          </Popover>
        </Section>

        <Section title="Tooltip">
          <Tooltip content="Tooltip content">
            <Button variant="secondary">Hover me</Button>
          </Tooltip>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="reading" className="max-w-md">
            <TabsList>
              <TabsTab value="reading">Reading</TabsTab>
              <TabsTab value="writing">Writing</TabsTab>
              <TabsTab value="listening">Listening</TabsTab>
            </TabsList>
            <TabsPanel value="reading">Reading practice lives here.</TabsPanel>
            <TabsPanel value="writing">Writing practice lives here.</TabsPanel>
            <TabsPanel value="listening">Listening practice lives here.</TabsPanel>
          </Tabs>
        </Section>

        <Section title="Progress">
          <Progress value={66} className="max-w-md" />
        </Section>

        <Section title="Progress ring — sizes">
          <ProgressRing
            data-testid="progress-ring-sm"
            value={30}
            size="sm"
            aria-label="Small progress"
          />
          <ProgressRing
            data-testid="progress-ring-md"
            value={66}
            size="md"
            aria-label="Medium progress"
          >
            <span className="text-foreground text-sm font-semibold">66%</span>
          </ProgressRing>
          <ProgressRing
            data-testid="progress-ring-lg"
            value={4}
            min={0}
            max={10}
            size="lg"
            aria-label="Level progress"
          >
            <span className="text-foreground text-lg font-semibold">Lv 4</span>
          </ProgressRing>
        </Section>

        <Section title="Badge — variants">
          <Badge data-testid="badge-neutral">Neutral</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="success">Mastering</Badge>
          <Badge variant="warning">Developing</Badge>
          <Badge variant="danger">Struggling</Badge>
          <Badge variant="gradient" data-testid="badge-gradient">
            New badge
          </Badge>
        </Section>

        <Section title="Badge — sizes">
          <Badge size="sm">Small</Badge>
          <Badge size="md">Medium</Badge>
        </Section>

        <Section title="Avatar">
          <Avatar data-testid="avatar-initials" size="sm" fallback="AB" alt="Alex Baker" />
          <Avatar size="md" fallback="AB" alt="Alex Baker" />
          <Avatar
            data-testid="avatar-image"
            size="lg"
            src="/icons/icon-192.png"
            alt="Lang-Tutor mascot"
            fallback="LT"
          />
        </Section>

        <Section title="Mascot — states & registers">
          <MascotDemo />
        </Section>

        <Section title="Stat">
          <Stat data-testid="stat-xp" label="Total XP" value={1240} />
          <Stat label="Day streak" value="12d" size="lg" />
          <Stat label="Level" value={4} icon="⭐" />
        </Section>

        <Section title="Skeleton">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </Section>

        <Section title="Tts button">
          <TtsButton text="Lang-Tutor helps you practise reading, writing, listening, and speaking." />
        </Section>

        <Section title="Passage library">
          <div className="border-border w-full rounded-xl border">
            <PassageLibraryClient
              title="Reading"
              description="Every generated passage lives here, offline-first."
              emptyLabel="reading"
              basePath="/reading"
            />
          </div>
        </Section>
      </div>
    </main>
  );
}
