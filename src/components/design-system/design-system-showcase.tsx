"use client";
import { useTranslations } from "@/i18n/provider";
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

export function DesignSystemShowcase() {
  const t = useTranslations();
  const selectOptions = [
    { label: t("platform.balanced"), value: "balanced" },
    { label: t("platform.compact"), value: "compact" },
    { label: t("platform.highContrast"), value: "contrast" },
  ] as const;
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
              {t("platform.dsIntroTag")}
            </Badge>
            <h1 className="font-display text-foreground mt-6 max-w-2xl text-3xl leading-tight font-bold tracking-[0.02em] sm:text-4xl lg:text-5xl">
              {t("platform.dsTitle")}
            </h1>
            <p className="text-muted-foreground mt-5 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">
              {t("platform.dsIntro")}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <StatusIndicator
                status="online"
                label={t("platform.previewReady")}
              />
              <span className="text-muted-foreground font-mono text-xs tracking-[0.12em] uppercase">
                DS / 0.1
              </span>
              <span className="text-muted-foreground font-mono text-xs tracking-[0.12em] uppercase">
                {t("platform.darkFirst")}
              </span>
            </div>
          </div>
        </header>

        <div className="mt-16 grid gap-16 lg:mt-20 lg:gap-24">
          <ShowcaseSection
            id="foundations"
            eyebrow={t("platform.dsFoundations")}
            title={t("platform.colorType")}
            description={t("platform.colorTypeHelp")}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <TokenSwatch
                className="bg-background"
                label={t("platform.background")}
                token="background"
              />
              <TokenSwatch
                className="bg-surface-elevated"
                label={t("platform.surface")}
                token="surface"
              />
              <TokenSwatch
                className="bg-primary"
                label={t("platform.primary")}
                token="primary"
              />
              <TokenSwatch
                className="bg-secondary"
                label={t("platform.secondary")}
                token="secondary"
              />
              <TokenSwatch
                className="bg-accent"
                label={t("platform.accent")}
                token="accent"
              />
              <TokenSwatch
                className="bg-success"
                label={t("platform.success")}
                token="success"
              />
              <TokenSwatch
                className="bg-warning"
                label={t("platform.warning")}
                token="warning"
              />
              <TokenSwatch
                className="bg-destructive"
                label={t("platform.destructive")}
                token="destructive"
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>{t("platform.typeSpecimens")}</CardTitle>
                  <CardDescription>{t("platform.typeHelp")}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div>
                    <p className="text-muted-foreground font-mono text-xs tracking-[0.14em] uppercase">
                      {t("platform.displayFont")}
                    </p>
                    <p className="font-display text-foreground mt-2 text-2xl font-semibold tracking-[0.04em] sm:text-3xl">
                      {t("platform.tacticalClarity")}
                    </p>
                  </div>
                  <Divider />
                  <div>
                    <p className="text-muted-foreground font-mono text-xs tracking-[0.14em] uppercase">
                      {t("platform.interfaceFont")}
                    </p>
                    <p className="text-foreground mt-2 max-w-xl text-base leading-7">
                      {t("platform.readableHelp")}
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
                  <CardTitle>{t("platform.spacingRhythm")}</CardTitle>
                  <CardDescription>{t("platform.spacingHelp")}</CardDescription>
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
            eyebrow={t("platform.dsActions")}
            title={t("platform.buttonsControls")}
            description={t("platform.buttonsHelp")}
          >
            <Card>
              <CardHeader>
                <CardTitle>{t("platform.buttonVariants")}</CardTitle>
                <CardDescription>
                  {t("platform.buttonHierarchy")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button>
                  {t("platform.primary")}
                  <Check aria-hidden="true" className="size-4" />
                </Button>
                <Button variant="secondary">{t("platform.secondary")}</Button>
                <Button variant="accent">{t("platform.accent")}</Button>
                <Button variant="outline">{t("platform.outline")}</Button>
                <Button variant="ghost">{t("platform.ghost")}</Button>
                <Button variant="destructive">
                  {t("platform.destructive")}
                </Button>
              </CardContent>
              <Divider label={t("platform.stateExamples")} />
              <CardContent className="flex flex-wrap gap-3 pt-6">
                <Button loading loadingText={t("platform.processing")}>
                  {t("platform.process")}
                </Button>
                <Button disabled variant="secondary">
                  {t("platform.disabled")}
                </Button>
                <Button aria-pressed="true" variant="outline">
                  {t("platform.pressed")}
                </Button>
              </CardContent>
            </Card>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t("platform.iconButtons")}</CardTitle>
                  <CardDescription>
                    {t("platform.iconButtonsHelp")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Tooltip content={t("platform.newItem")}>
                    <IconButton
                      label={t("platform.createItem")}
                      variant="secondary"
                    >
                      <Plus aria-hidden="true" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content={t("platform.copyReference")}>
                    <IconButton
                      label={t("platform.copyReference")}
                      variant="outline"
                    >
                      <Copy aria-hidden="true" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content={t("platform.notificationPrefs")}>
                    <IconButton
                      label={t("platform.notificationPrefs")}
                      variant="ghost"
                    >
                      <Bell aria-hidden="true" />
                    </IconButton>
                  </Tooltip>
                  <IconButton
                    label={t("platform.loadingAction")}
                    loading
                    variant="accent"
                  >
                    <RefreshCcw aria-hidden="true" />
                  </IconButton>
                  <IconButton label={t("platform.unavailableAction")} disabled>
                    <Settings2 aria-hidden="true" />
                  </IconButton>
                </CardContent>
              </Card>

              <Card variant="elevated">
                <CardHeader>
                  <CardTitle>{t("platform.dialog")}</CardTitle>
                  <CardDescription>{t("platform.dialogHelp")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        {t("platform.openDialogPreview")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("platform.confirmChoice")}</DialogTitle>
                        <DialogDescription>
                          {t("platform.previewDialogHelp")}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="border-border bg-muted text-muted-foreground rounded-md border p-4 text-sm leading-6">
                        {t("platform.dialogContentHelp")}
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="ghost">
                            {t("platform.cancel")}
                          </Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button>{t("platform.confirmPreview")}</Button>
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
            eyebrow={t("platform.dsForms")}
            title={t("platform.inputsSelection")}
            description={t("platform.inputsHelp")}
          >
            <Card variant="elevated">
              <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
                <Input
                  label={t("platform.displayLabel")}
                  description={t("platform.displayLabelHelp")}
                  placeholder={t("platform.enterLabel")}
                  leadingIcon={<Mail aria-hidden="true" />}
                />
                <Select
                  label={t("platform.interfaceDensity")}
                  description={t("platform.previewOnly")}
                  defaultValue="balanced"
                  options={selectOptions}
                />
                <Input
                  label={t("platform.validationExample")}
                  defaultValue={t("platform.unsupportedValue")}
                  error={t("platform.validationHelp")}
                  leadingIcon={<Search aria-hidden="true" />}
                />
                <Input
                  label={t("platform.disabledField")}
                  defaultValue={t("platform.unavailablePhase")}
                  disabled
                  leadingIcon={<SlidersHorizontal aria-hidden="true" />}
                />
              </CardContent>
            </Card>
          </ShowcaseSection>

          <ShowcaseSection
            id="surfaces"
            eyebrow={t("platform.dsSurfaces")}
            title={t("platform.cardsIdentity")}
            description={t("platform.surfaceHelp")}
          >
            <Tabs defaultValue="cards">
              <TabsList aria-label={t("platform.surfaceExamples")}>
                <TabsTrigger value="cards">{t("platform.cards")}</TabsTrigger>
                <TabsTrigger value="labels">{t("platform.labels")}</TabsTrigger>
                <TabsTrigger value="identity">
                  {t("platform.identity")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="cards">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card padding="md">
                    <Badge size="sm">{t("platform.default")}</Badge>
                    <h3 className="font-display text-foreground mt-5 text-base font-semibold">
                      {t("platform.standardSurface")}
                    </h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {t("platform.standardSurfaceHelp")}
                    </p>
                  </Card>
                  <Card padding="md" variant="elevated">
                    <Badge size="sm" variant="primary">
                      {t("platform.elevated")}
                    </Badge>
                    <h3 className="font-display text-foreground mt-5 text-base font-semibold">
                      {t("platform.prioritySurface")}
                    </h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {t("platform.prioritySurfaceHelp")}
                    </p>
                  </Card>
                  <Card padding="md" variant="subtle">
                    <Badge size="sm" variant="outline">
                      {t("platform.subtle")}
                    </Badge>
                    <h3 className="font-display text-foreground mt-5 text-base font-semibold">
                      {t("platform.quietSurface")}
                    </h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {t("platform.quietSurfaceHelp")}
                    </p>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="labels">
                <Card padding="md">
                  <div className="flex flex-wrap gap-3">
                    <Badge>{t("platform.neutral")}</Badge>
                    <Badge variant="primary">{t("platform.primary")}</Badge>
                    <Badge variant="accent">{t("platform.accent")}</Badge>
                    <Badge variant="success">{t("platform.success")}</Badge>
                    <Badge variant="warning">{t("platform.warning")}</Badge>
                    <Badge variant="destructive">
                      {t("platform.destructive")}
                    </Badge>
                    <Badge variant="outline">{t("platform.outline")}</Badge>
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
                        aria-label={t("platform.smallAvatar")}
                      >
                        <AvatarFallback>TP</AvatarFallback>
                      </Avatar>
                      <Avatar
                        size="md"
                        role="img"
                        aria-label={t("platform.mediumAvatar")}
                      >
                        <AvatarFallback>TP</AvatarFallback>
                      </Avatar>
                      <Avatar
                        size="lg"
                        role="img"
                        aria-label={t("platform.largeAvatar")}
                      >
                        <AvatarFallback>TP</AvatarFallback>
                      </Avatar>
                      <Avatar
                        size="xl"
                        role="img"
                        aria-label={t("platform.largeAvatar")}
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
            eyebrow={t("platform.dsFeedback")}
            title={t("platform.feedbackConventions")}
            description={t("platform.feedbackHelp")}
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <Card aria-busy="true" aria-label={t("platform.loadingPreview")}>
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
                title={t("platform.nothingPreview")}
                description={t("platform.emptyPreviewHelp")}
                action={
                  <Button size="sm" variant="outline">
                    {t("platform.clearFilters")}
                  </Button>
                }
              />

              <ErrorState
                title={t("platform.previewUnavailable")}
                description={t("platform.previewErrorHelp")}
                action={
                  <Button size="sm" variant="outline">
                    <RefreshCcw aria-hidden="true" className="size-4" />
                    {t("platform.retry")}
                  </Button>
                }
              />
            </div>
          </ShowcaseSection>
        </div>

        <footer className="border-border mt-16 border-t pt-6 lg:mt-24">
          <div className="text-muted-foreground flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>{t("platform.dsFooter")}</p>
            <p className="font-mono text-xs tracking-[0.1em] uppercase">
              {t("platform.dsStandards")}
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default DesignSystemShowcase;
