import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/cn";

const skeletonVariants = cva(
  "animate-pulse bg-surface-interactive motion-reduce:animate-none",
  {
    variants: {
      radius: {
        sm: "rounded-sm",
        md: "rounded-md",
        lg: "rounded-lg",
        full: "rounded-full",
      },
    },
    defaultVariants: {
      radius: "md",
    },
  },
);

export interface SkeletonProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  label?: string;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, label, radius, ...props }, ref) => (
    <div
      ref={ref}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(skeletonVariants({ radius }), className)}
      {...props}
    />
  ),
);

Skeleton.displayName = "Skeleton";
