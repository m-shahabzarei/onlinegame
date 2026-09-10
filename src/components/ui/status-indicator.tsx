"use client";
import { useTranslations } from "@/i18n/provider";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/cn";

const statusDotVariants = cva("shrink-0 rounded-full ring-2 ring-background", {
  variants: {
    status: {
      online: "bg-success",
      away: "bg-warning",
      busy: "bg-destructive",
      offline: "bg-muted-foreground",
    },
    size: {
      sm: "size-2",
      md: "size-2.5",
      lg: "size-3",
    },
  },
  defaultVariants: {
    status: "offline",
    size: "md",
  },
});

export interface StatusIndicatorProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusDotVariants> {
  label?: string;
  showLabel?: boolean;
}

export const StatusIndicator = React.forwardRef<
  HTMLSpanElement,
  StatusIndicatorProps
>(
  (
    { className, label, showLabel = true, size, status = "offline", ...props },
    ref,
  ) => {
    const t = useTranslations();

    const defaultLabels = {
      away: t("platform.away"),
      busy: t("platform.busy"),
      offline: t("platform.offline"),
      online: t("platform.online"),
    } as const;
    const statusLabel = label ?? defaultLabels[status ?? "offline"];

    return (
      <span
        ref={ref}
        role="status"
        aria-label={showLabel ? undefined : statusLabel}
        className={cn(
          "text-muted-foreground inline-flex items-center gap-2 text-sm",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={statusDotVariants({ size, status })}
        />
        {showLabel ? <span>{statusLabel}</span> : null}
      </span>
    );
  },
);

StatusIndicator.displayName = "StatusIndicator";
