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
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  Tooltip,
} from "@/ui";

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
      <header className="mb-10">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">UI gallery</h1>
        <p className="text-muted mt-1 text-sm">
          Every wrapper in the <code>ui/</code> layer (Base UI + Tailwind). Dev-only preview.
        </p>
      </header>

      <div className="space-y-10">
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
      </div>
    </main>
  );
}
