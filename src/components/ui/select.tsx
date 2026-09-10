"use client";
import { useTranslations } from "@/i18n/provider";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, CircleAlert } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/cn";

export interface SelectOption {
  disabled?: boolean;
  label: string;
  value: string;
}

export interface SelectProps extends Omit<
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
  "children"
> {
  ariaLabel?: string;
  className?: string;
  contentClassName?: string;
  description?: string;
  error?: string;
  id?: string;
  label?: string;
  options: readonly SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      ariaLabel,
      className,
      contentClassName,
      description,
      disabled = false,
      error,
      id,
      label,
      options,
      placeholder,
      ...rootProps
    },
    ref,
  ) => {
    const t = useTranslations();

    const generatedId = React.useId();
    const triggerId = id ?? generatedId;
    const descriptionId = `${triggerId}-description`;
    const errorId = `${triggerId}-error`;

    return (
      <div className="grid gap-2">
        {label ? (
          <label
            className="text-foreground text-sm font-semibold"
            htmlFor={triggerId}
          >
            {label}
          </label>
        ) : null}
        <SelectPrimitive.Root disabled={disabled} {...rootProps}>
          <SelectPrimitive.Trigger
            ref={ref}
            id={triggerId}
            aria-label={ariaLabel}
            aria-describedby={
              [
                description ? descriptionId : undefined,
                error ? errorId : undefined,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            aria-errormessage={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            className={cn(
              "border-border-strong bg-surface-interactive text-foreground shadow-card hover:border-primary/65 focus-visible:border-primary focus-visible:ring-ring focus-visible:ring-offset-background active:bg-surface-pressed data-[placeholder]:text-muted-foreground/75 data-[state=open]:border-primary data-[state=open]:ring-primary/30 aria-invalid:border-destructive flex h-12 w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-md border px-3 text-start text-base transition-[background-color,border-color,box-shadow,opacity] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 data-[state=open]:ring-2 [&>span]:truncate",
              className,
            )}
          >
            <SelectPrimitive.Value
              placeholder={placeholder ?? t("platform.selectOption")}
            />
            <SelectPrimitive.Icon asChild>
              <ChevronDown
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
                strokeWidth={1.75}
              />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              position="popper"
              sideOffset={8}
              className={cn(
                "border-border-strong bg-surface-elevated text-foreground shadow-dialog z-[var(--z-dialog)] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border transition-[opacity,transform] duration-200 ease-out data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100",
                contentClassName,
              )}
            >
              <SelectPrimitive.ScrollUpButton className="text-muted-foreground flex min-h-11 cursor-default items-center justify-center">
                <ChevronUp aria-hidden="true" className="size-4" />
              </SelectPrimitive.ScrollUpButton>
              <SelectPrimitive.Viewport className="p-1">
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled ?? false}
                    className="text-foreground data-[highlighted]:bg-surface-hover data-[highlighted]:text-foreground data-[state=checked]:bg-primary-subtle data-[state=checked]:text-primary relative flex min-h-11 cursor-pointer items-center rounded-sm py-2 ps-3 pe-8 text-sm transition-colors duration-150 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
                  >
                    <SelectPrimitive.ItemText>
                      {option.label}
                    </SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute end-2 inline-flex items-center justify-center">
                      <Check aria-hidden="true" className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Viewport>
              <SelectPrimitive.ScrollDownButton className="text-muted-foreground flex min-h-11 cursor-default items-center justify-center">
                <ChevronDown aria-hidden="true" className="size-4" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
        {description ? (
          <p id={descriptionId} className="text-muted-foreground text-sm">
            {description}
          </p>
        ) : null}
        {error ? (
          <p
            id={errorId}
            className="text-destructive flex items-start gap-2 text-sm"
            role="alert"
          >
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={1.75}
            />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    );
  },
);

Select.displayName = "Select";
