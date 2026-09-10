import { LocalizedLoading } from "./localized-loading";

import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md border text-sm font-semibold select-none transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:translate-y-px aria-pressed:ring-2 aria-pressed:ring-primary/55 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        primary:
          "border-primary bg-primary text-primary-foreground shadow-glow hover:border-primary-hover hover:bg-primary-hover active:border-primary-pressed active:bg-primary-pressed",
        secondary:
          "border-border-strong bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-pressed",
        accent:
          "border-accent bg-accent text-accent-foreground hover:border-accent-hover hover:bg-accent-hover active:border-accent-pressed active:bg-accent-pressed",
        outline:
          "border-border-strong bg-transparent text-foreground hover:border-primary/70 hover:bg-surface-hover active:bg-surface-pressed",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground active:bg-surface-pressed",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:border-destructive-hover hover:bg-destructive-hover active:border-destructive-pressed active:bg-destructive-pressed",
      },
      size: {
        sm: "h-11 px-4",
        md: "h-12 px-5 text-base",
        lg: "h-14 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      disabled,
      loading = false,
      loadingText,
      size,
      type = "button",
      variant,
      ...props
    },
    ref,
  ) => {
    const statusText = loadingText ?? <LocalizedLoading />;

    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={cn(buttonVariants({ size, variant }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
      >
        <span className="grid place-items-center">
          <span
            aria-hidden={loading || undefined}
            className={cn(
              "col-start-1 row-start-1 inline-flex items-center gap-2",
              loading && "invisible",
            )}
          >
            {children}
          </span>
          <span
            aria-hidden={loading ? undefined : true}
            className={cn(
              "col-start-1 row-start-1 inline-flex items-center gap-2",
              !loading && "invisible",
            )}
            role={loading ? "status" : undefined}
          >
            <LoaderCircle
              aria-hidden="true"
              className={cn(
                "size-4",
                loading && "animate-spin motion-reduce:animate-none",
              )}
              data-testid="button-spinner"
            />
            <span>{statusText}</span>
          </span>
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";
