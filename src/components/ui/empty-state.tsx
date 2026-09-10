import { Inbox } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/cn";

export interface EmptyStateProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "title"
> {
  action?: React.ReactNode;
  description: React.ReactNode;
  icon?: React.ReactNode;
  title: React.ReactNode;
  titleAs?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export const EmptyState = React.forwardRef<HTMLElement, EmptyStateProps>(
  (
    {
      action,
      className,
      description,
      icon,
      title,
      titleAs: Title = "h3",
      ...props
    },
    ref,
  ) => (
    <section
      ref={ref}
      className={cn(
        "border-border-strong bg-muted/50 flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center sm:p-8",
        className,
      )}
      {...props}
    >
      <span className="border-border bg-surface-interactive text-primary shadow-card mb-4 inline-flex size-12 items-center justify-center rounded-lg border [&_svg]:size-5 [&_svg]:stroke-[1.75]">
        {icon ?? <Inbox aria-hidden="true" />}
      </span>
      <Title className="font-display text-foreground text-base font-semibold tracking-[0.04em]">
        {title}
      </Title>
      <div className="text-muted-foreground mt-2 max-w-md text-sm leading-6">
        {description}
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  ),
);

EmptyState.displayName = "EmptyState";
