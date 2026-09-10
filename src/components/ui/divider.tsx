import * as React from "react";

import { cn } from "@/lib/cn";

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  orientation?: "horizontal" | "vertical";
}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  (
    {
      className,
      label,
      orientation = "horizontal",
      role = "separator",
      ...props
    },
    ref,
  ) => {
    if (orientation === "vertical") {
      return (
        <div
          ref={ref}
          role={role}
          aria-orientation="vertical"
          className={cn("bg-border h-full min-h-6 w-px shrink-0", className)}
          {...props}
        />
      );
    }

    if (label) {
      return (
        <div
          ref={ref}
          role={role}
          aria-label={label}
          aria-orientation="horizontal"
          className={cn("flex w-full items-center gap-3", className)}
          {...props}
        >
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground font-mono text-xs tracking-[0.12em] uppercase">
            {label}
          </span>
          <span className="bg-border h-px flex-1" />
        </div>
      );
    }

    return (
      <div
        ref={ref}
        role={role}
        aria-orientation="horizontal"
        className={cn("bg-border h-px w-full shrink-0", className)}
        {...props}
      />
    );
  },
);

Divider.displayName = "Divider";
