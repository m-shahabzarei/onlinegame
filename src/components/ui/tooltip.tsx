"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";

import { cn } from "@/lib/cn";

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps extends Omit<
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>,
  "children"
> {
  align?: React.ComponentPropsWithoutRef<
    typeof TooltipPrimitive.Content
  >["align"];
  children: React.ReactElement;
  content: React.ReactNode;
  contentClassName?: string;
  side?: React.ComponentPropsWithoutRef<
    typeof TooltipPrimitive.Content
  >["side"];
}

export function Tooltip({
  align = "center",
  children,
  content,
  contentClassName,
  side = "top",
  ...props
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={100}>
      <TooltipPrimitive.Root {...props}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            align={align}
            side={side}
            sideOffset={8}
            className={cn(
              "tp-tooltip-content border-border-strong bg-surface-elevated text-foreground shadow-dialog z-[var(--z-tooltip)] max-w-64 rounded-md border px-3 py-2 text-sm leading-5",
              contentClassName,
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-surface-elevated" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
