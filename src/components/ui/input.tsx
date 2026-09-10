"use client";

import { CircleAlert } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/cn";

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  containerClassName?: string;
  description?: string;
  error?: string | undefined;
  label?: string;
  leadingIcon?: React.ReactNode;
  trailingContent?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      className,
      containerClassName,
      description,
      disabled,
      error,
      id,
      label,
      leadingIcon,
      readOnly,
      trailingContent,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const descriptionId = `${inputId}-description`;
    const errorId = `${inputId}-error`;
    const describedBy = [
      ariaDescribedBy,
      description ? descriptionId : undefined,
      error ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={cn("grid gap-2", containerClassName)}>
        {label ? (
          <label
            className="text-foreground text-sm font-semibold"
            htmlFor={inputId}
          >
            {label}
          </label>
        ) : null}
        <div className="relative">
          {leadingIcon ? (
            <span
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex w-11 items-center justify-center [&_svg]:size-4 [&_svg]:stroke-[1.75]"
            >
              {leadingIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            aria-describedby={describedBy || undefined}
            aria-errormessage={error ? errorId : undefined}
            aria-invalid={error ? true : ariaInvalid}
            className={cn(
              "border-border-strong bg-surface-interactive text-foreground shadow-card placeholder:text-muted-foreground/75 hover:border-primary/65 focus-visible:border-primary focus-visible:ring-ring focus-visible:ring-offset-background read-only:bg-muted read-only:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-12 w-full min-w-0 rounded-md border px-3 text-base transition-[background-color,border-color,box-shadow,opacity] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45",
              leadingIcon && "ps-11",
              trailingContent && "pe-11",
              className,
            )}
            disabled={disabled}
            readOnly={readOnly}
            {...props}
          />
          {trailingContent ? (
            <span className="text-muted-foreground absolute inset-y-0 end-0 flex min-w-11 items-center justify-center">
              {trailingContent}
            </span>
          ) : null}
        </div>
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
              className="mt-0.5 size-4 shrink-0 stroke-[1.75]"
            />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
