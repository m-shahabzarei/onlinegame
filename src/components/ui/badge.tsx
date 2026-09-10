import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-muted-foreground",
        primary:
          "border-primary/35 bg-primary-subtle text-primary hover:border-primary/55",
        accent: "border-accent/35 bg-accent-subtle text-accent",
        success: "border-success/35 bg-success-subtle text-success-foreground",
        warning: "border-warning/35 bg-warning-subtle text-warning-foreground",
        destructive:
          "border-destructive/35 bg-destructive-subtle text-destructive",
        outline: "border-border-strong bg-transparent text-foreground",
      },
      size: {
        sm: "min-h-6 px-2 py-0.5 text-xs",
        md: "min-h-7 px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, size, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ size, variant }), className)}
      {...props}
    />
  ),
);

Badge.displayName = "Badge";
