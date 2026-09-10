import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/cn";

const iconButtonVariants = cva(
  "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground active:bg-surface-pressed",
        outline:
          "border-border-strong bg-transparent text-foreground hover:border-primary/70 hover:bg-surface-hover active:bg-surface-pressed",
        secondary:
          "border-border-strong bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-pressed",
        accent:
          "border-accent bg-accent text-accent-foreground hover:border-accent-hover hover:bg-accent-hover active:bg-accent-pressed",
        destructive:
          "border-destructive/60 bg-destructive-subtle text-destructive hover:border-destructive hover:bg-destructive/20 active:bg-destructive/30",
      },
      size: {
        sm: "size-11 [&_svg]:size-4",
        md: "size-12 [&_svg]:size-5",
        lg: "size-14 [&_svg]:size-6",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  },
);

export interface IconButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">,
    VariantProps<typeof iconButtonVariants> {
  label: string;
  loading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      className,
      disabled,
      label,
      loading = false,
      size,
      type = "button",
      variant,
      ...props
    },
    ref,
  ) => (
    <button
      {...props}
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      aria-label={label}
      className={cn(iconButtonVariants({ size, variant }), className)}
      disabled={disabled || loading}
    >
      {loading ? (
        <LoaderCircle
          aria-hidden="true"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        children
      )}
    </button>
  ),
);

IconButton.displayName = "IconButton";
