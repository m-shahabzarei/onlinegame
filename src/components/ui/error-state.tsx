import { TriangleAlert } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/cn";

export interface ErrorStateProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  "title"
> {
  action?: React.ReactNode;
  description: React.ReactNode;
  icon?: React.ReactNode;
  title: React.ReactNode;
  titleAs?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export const ErrorState = React.forwardRef<HTMLElement, ErrorStateProps>(
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
      role="alert"
      className={cn(
        "border-destructive/35 bg-destructive-subtle/75 flex min-h-64 flex-col items-center justify-center rounded-lg border p-6 text-center sm:p-8",
        className,
      )}
      {...props}
    >
      <span className="border-destructive/35 bg-destructive-subtle text-destructive shadow-card mb-4 inline-flex size-12 items-center justify-center rounded-lg border [&_svg]:size-5 [&_svg]:stroke-[1.75]">
        {icon ?? <TriangleAlert aria-hidden="true" />}
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

ErrorState.displayName = "ErrorState";
