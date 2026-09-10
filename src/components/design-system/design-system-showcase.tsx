import {
  Bell,
  Check,
  Copy,
  Layers3,
  Mail,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Select,
  Skeleton,
  StatusIndicator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "@/components/ui";
import { cn } from "@/lib/cn";

interface ShowcaseSectionProps {
  children: ReactNode;
  className?: string;
  description: string;
  eyebrow: string;
  id: string;
  title: string;
}

function ShowcaseSection({
  children,
  className,
  description,
  eyebrow,
  id,
  title,
}: ShowcaseSectionProps) {
  const titleId = `${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn("scroll-mt-8", className)}
    >
      <div className="mb-6 max-w-2xl">
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.16em] uppercase">
          {eyebrow}
        </p>
        <h2
          id={titleId}
          className="font-display text-foreground mt-2 text-xl font-semibold tracking-[0.03em] sm:text-2xl"
        >
          {title}
        </h2>
        <p className="text-muted-foreground mt-3 text-base leading-7">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

interface TokenSwatchProps {
  className: string;
  label: string;
  token: string;
}

function TokenSwatch({ className, label, token }: TokenSwatchProps) {
  return (
    <div className="border-border bg-surface shadow-card rounded-md border p-3">
      <div
        aria-hidden="true"
        className={cn("border-border h-16 rounded-sm border", className)}
      />
      <p className="text-foreground mt-3 text-sm font-semibold">{label}</p>
      <code className="text-muted-foreground mt-1 block font-mono text-xs">
        {token}
      </code>
    </div>
  );
}

const selectOptions = [
  { label: "Balanced", value: "balanced" },
  { label: "Compact", value: "compact" },
  { label: "High contrast", value: "contrast" },
] as const;

export function DesignSystemShowcase() {
  return (
    <main id="main-content" className="min-h-dvh overflow-x-clip">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16 2xl:px-12">
        <header className="border-border bg-surface/80 shadow-glow relative overflow-hidden rounded-xl border p-6 backdrop-blur-md sm:p-8 lg:p-10">
          <div
            aria-hidden="true"
            className="border-border bg-primary-subtle/30 pointer-events-none absolute inset-y-0 end-0 hidden w-1/3 border-s lg:block"
          />
          <div className="relative max-w-3xl">
            <Badge variant="primary">
              <Layers3 aria-hidden="true" className="size-3.5" />
              Internal foundation · Phase 1
            </Badge>
            <h1 className="font-display text-foreground mt-6 max-w-2xl text-3xl leading-tight font-bold tracking-[0.02em] sm:text-4xl lg:text-5xl">
              TwoPlayer interface system
            </h1>
            <p className="text-muted-foreground mt-5 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">
              A restrained, cinematic component language for future TwoPlayer
              surfaces. This route previews the foundation only—no lobby, room,
              or gameplay behavior is connected.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <StatusIndicator status="online" label="Preview ready" />
              <span className="text-muted-foreground font-mono text-xs tracking-[0.12em] uppercase">
                DS / 0.1
              </span>
              <span className="text-muted-foreground font-mono text-xs tracking-[0.12em] uppercase">
                Dark first
              </span>
            </div>
          </div>
        </header>

        <div className="mt-16 grid gap-16 lg:mt-20 lg:gap-24">
          <ShowcaseSection
            id="foundations"
            eyebrow="01 / Foundations"
            title="Color, type, and rhythm"
            description="Semantic tokens carry meaning across components. The palette uses cool dark surfaces, precise violet hierarchy, and a controlled rose accent."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <TokenSwatch
                className="bg-background"
                label="Background"
                token="background"
              />
              <TokenSwatch
                className="bg-surface-elevated"
                label="Surface"
                token="surface"
              />
              <TokenSwatch
                className="bg-primary"
                label="Primary"
                token="primary"
              />
              <TokenSwatch
                className="bg-secondary"
                label="Secondary"
                token="secondary"
              />
              <TokenSwatch
                className="bg-accent"
                label="Accent"
                token="accent"
              />
              <TokenSwatch
                className="bg-success"
                label="Success"
                token="success"
              />
              <TokenSwatch
                className="bg-warning"
                label="Warning"
                token="warning"
              />
              <TokenSwatch
                className="bg-destructive"
                label="Destructive"
                token="destructive"
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Typography specimens</CardTitle>
                  <CardDescription>
                    Display, interface, technical, and Persian-capable families
                    share a consistent metric rhythm.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div>
                    <p className="text-muted-foreground font-mono text-xs tracking-[0.14em] uppercase">
                      Display / Orbitron
                    </p>
                    <p className="font-display text-foreground mt-2 text-2xl font-semibold tracking-[0.04em] sm:text-3xl">
                      Tactical clarity
                    </p>
                  </div>
                  <Divider />
                  <div>
                    <p className="text-muted-foreground font-mono text-xs tracking-[0.14em] uppercase">
                      Interface / Geist
                    </p>
                    <p className="text-foreground mt-2 max-w-xl text-base leading-7">
                      Readable at speed, calm at rest, and clear across compact
                      controls and longer explanations.
                    </p>
                  </div>
                  <Divider />
                  <div lang="fa" dir="rtl">
                    <p className="font-persian text-muted-foreground text-sm">
                      نمونه تایپوگرافی فارسی
                    </p>
                    <p className="font-persian text-foreground mt-2 text-xl font-semibold">
                      همکاری، دقت و هماهنگی
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Spacing rhythm</CardTitle>
                  <CardDescription>
                    A four-pixel base keeps dense controls and spacious sections
                    in the same visual cadence.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {[4, 8, 16, 24, 32].map((space) => (
                    <div key={space} className="flex items-center gap-4">
                      <span className="text-muted-foreground w-10 font-mono text-xs">
                        {space}
                      </span>
                      <span
                        aria-hidden="true"
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${space * 3}px` }}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </ShowcaseSection>

          <ShowcaseSection
            id="actions"
            eyebrow="02 / Actions"
            title="Buttons and compact controls"
            description="Every target is at least 44px, exposes a visible keyboard focus ring, and keeps hover, pressed, loading, and disabled feedback within a stable footprint."
          >
            <Card>
              <CardHeader>
                <CardTitle>Button variants</CardTitle>
                <CardDescription>
                  Primary hierarchy stays indigo; rose is reserved for a focused
                  high-value accent.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button>
                  Primary
                  <Check aria-hidden="true" className="size-4" />
                </Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="accent">Accent</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </CardContent>
              <Divider label="State examples" />
              <CardContent className="flex flex-wrap gap-3 pt-6">
                <Button loading loadingText="Processing">
                  Process
                </Button>
                <Button disabled variant="secondary">
                  Disabled
                </Button>
                <Button aria-pressed="true" variant="outline">
                  Pressed
                </Button>
              </CardContent>
            </Card>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Icon buttons</CardTitle>
                  <CardDescription>
                    Each icon-only action requires an explicit accessible label.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Tooltip content="Create a new item">
                    <IconButton label="Create item" variant="secondary">
                      <Plus aria-hidden="true" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="Copy reference">
                    <IconButton label="Copy reference" variant="outline">
                      <Copy aria-hidden="true" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="Notification preferences">
                    <IconButton
                      label="Notification preferences"
                      variant="ghost"
                    >
                      <Bell aria-hidden="true" />
                    </IconButton>
                  </Tooltip>
                  <IconButton label="Loading action" loading variant="accent">
                    <RefreshCcw aria-hidden="true" />
                  </IconButton>
                  <IconButton label="Unavailable action" disabled>
                    <Settings2 aria-hidden="true" />
                  </IconButton>
                </CardContent>
              </Card>

              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>Dialog</CardTitle>
                  <CardDescription>
                    Radix manages focus trapping, Escape dismissal, and return
                    focus while the visual layer remains provider-neutral.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Open dialog preview</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm interface choice</DialogTitle>
                        <DialogDescription>
                          This preview demonstrates focus management and action
                          hierarchy. It does not save or trigger a product flow.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="border-border bg-muted text-muted-foreground rounded-md border p-4 text-sm leading-6">
                        Dialog content stays readable against a strong scrim and
                        uses restrained blur only to separate layers.
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="ghost">Cancel</Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button>Confirm preview</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          </ShowcaseSection>

          <ShowcaseSection
            id="forms"
            eyebrow="03 / Forms"
            title="Inputs and selection"
            description="Labels remain visible, helper and recovery text sit next to their controls, and error meaning is never communicated by color alone."
          >
            <Card variant="elevated">
              <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
                <Input
                  label="Display label"
                  description="Use a concise, recognizable interface name."
                  placeholder="Enter a label"
                  leadingIcon={<Mail aria-hidden="true" />}
                />
                <Select
                  label="Interface density"
                  description="This changes the preview only."
                  defaultValue="balanced"
                  options={selectOptions}
                />
                <Input
                  label="Validation example"
                  defaultValue="Unsupported value"
                  error="Choose a value that uses letters and numbers only."
                  leadingIcon={<Search aria-hidden="true" />}
                />
                <Input
                  label="Disabled field"
                  defaultValue="Unavailable in this phase"
                  disabled
                  leadingIcon={<SlidersHorizontal aria-hidden="true" />}
                />
              </CardContent>
            </Card>
          </ShowcaseSection>

          <ShowcaseSection
            id="surfaces"
            eyebrow="04 / Surfaces"
            title="Cards, badges, identity, and status"
            description="Subtle borders and controlled elevation establish depth. Status examples include text labels so meaning never depends on hue alone."
          >
            <Tabs defaultValue="cards">
              <TabsList aria-label="Surface primitive examples">
                <TabsTrigger value="cards">Cards</TabsTrigger>
                <TabsTrigger value="labels">Labels</TabsTrigger>
                <TabsTrigger value="identity">Identity</TabsTrigger>
              </TabsList>
              <TabsContent value="cards">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card padding="md">
                    <Badge size="sm">Default</Badge>
                    <h3 className="font-display text-foreground mt-5 text-base font-semibold">
                      Standard surface
                    </h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      Low elevation for ordinary content grouping.
                    </p>
                  </Card>
                  <Card padding="md" variant="elevated">
                    <Badge size="sm" variant="primary">
                      Elevated
                    </Badge>
                    <h3 className="font-display text-foreground mt-5 text-base font-semibold">
                      Priority surface
                    </h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      Stronger separation without an excessive glow.
                    </p>
                  </Card>
                  <Card padding="md" variant="subtle">
                    <Badge size="sm" variant="outline">
                      Subtle
                    </Badge>
                    <h3 className="font-display text-foreground mt-5 text-base font-semibold">
                      Quiet surface
                    </h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      Recedes when surrounding content needs priority.
                    </p>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="labels">
                <Card padding="md">
                  <div className="flex flex-wrap gap-3">
                    <Badge>Neutral</Badge>
                    <Badge variant="primary">Primary</Badge>
                    <Badge variant="accent">Accent</Badge>
                    <Badge variant="success">Success</Badge>
                    <Badge variant="warning">Warning</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                    <Badge variant="outline">Outline</Badge>
                  </div>
                </Card>
              </TabsContent>
              <TabsContent value="identity">
                <Card padding="md">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-end gap-3">
                      <Avatar
                        size="sm"
                        role="img"
                        aria-label="Small avatar example"
                      >
                        <AvatarFallback>TP</AvatarFallback>
                      </Avatar>
                      <Avatar
                        size="md"
                        role="img"
                        aria-label="Medium avatar example"
                      >
                        <AvatarFallback>TP</AvatarFallback>
                      </Avatar>
                      <Avatar
                        size="lg"
                        role="img"
                        aria-label="Large avatar example"
                      >
                        <AvatarFallback>TP</AvatarFallback>
                      </Avatar>
                      <Avatar
                        size="xl"
                        role="img"
                        aria-label="Extra-large avatar example"
                      >
                        <AvatarFallback>TP</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                      <StatusIndicator status="online" />
                      <StatusIndicator status="away" />
                      <StatusIndicator status="busy" />
                      <StatusIndicator status="offline" />
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </ShowcaseSection>

          <ShowcaseSection
            id="feedback"
            eyebrow="05 / Feedback"
            title="Loading, empty, and error conventions"
            description="Reserved skeleton geometry prevents layout shift. Empty and error states explain what happened and offer a clear next action."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <Card aria-busy="true" aria-label="Loading content preview">
                <CardHeader>
                  <Skeleton className="h-4 w-24" radius="full" />
                  <Skeleton className="h-7 w-2/3" />
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="mt-3 h-24 w-full" radius="lg" />
                </CardContent>
              </Card>

              <EmptyState
                title="Nothing to preview"
                description="Clear the active filters or create a new component sample."
                action={
                  <Button size="sm" variant="outline">
                    Clear filters
                  </Button>
                }
              />

              <ErrorState
                title="Preview unavailable"
                description="The sample could not be rendered. Retry the local preview."
                action={
                  <Button size="sm" variant="outline">
                    <RefreshCcw aria-hidden="true" className="size-4" />
                    Retry
                  </Button>
                }
              />
            </div>
          </ShowcaseSection>
        </div>

        <footer className="border-border mt-16 border-t pt-6 lg:mt-24">
          <div className="text-muted-foreground flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>TwoPlayer design-system preview · Product foundation only</p>
            <p className="font-mono text-xs tracking-[0.1em] uppercase">
              44px targets / AA contrast / reduced motion
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default DesignSystemShowcase;
