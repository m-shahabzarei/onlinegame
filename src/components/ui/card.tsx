import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/cn";

const cardVariants = cva("rounded-lg border", {
  variants: {
    variant: {
      default: "border-border bg-surface/90 shadow-card backdrop-blur-sm",
      elevated:
        "border-border-strong/70 bg-surface-elevated shadow-card backdrop-blur-md",
      subtle: "border-border/70 bg-muted/70",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-6 sm:p-8",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "none",
  },
});

export interface CardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ padding, variant }), className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2 p-6", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as: Title = "h3", className, ...props }, ref) => (
    <Title
      ref={ref}
      className={cn(
        "font-display text-foreground text-base font-semibold tracking-[0.04em]",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-muted-foreground text-sm leading-6", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 pb-6", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "border-border flex flex-wrap items-center gap-3 border-t px-6 py-4",
      className,
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
