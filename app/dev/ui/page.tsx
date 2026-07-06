"use client";

import { type ReactNode } from "react";
import {
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
  PassageLibraryClient,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Skeleton,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  Tooltip,
  TtsButton,
} from "@/ui";
import { PaletteSwitcher } from "./palette-switcher";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
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

        <Section title="Card">
          <Card className="max-w-sm">
            <CardTitle>Card title</CardTitle>
            <CardDescription>A hand-built surface using theme tokens.</CardDescription>
            <CardContent>
              <Button size="sm">Action</Button>
            </CardContent>
          </Card>
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
