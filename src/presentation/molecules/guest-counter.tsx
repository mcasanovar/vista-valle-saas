"use client";

import { Button, Icon } from "@/presentation/atoms";

export function GuestCounter({
  className = "",
  label,
  value,
  min,
  max,
  error,
  onChange,
}: Readonly<{
  className?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  error?: string;
  onChange: (value: number) => void;
}>) {
  if (
    !Number.isSafeInteger(value) ||
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(max) ||
    min > max ||
    value < min ||
    value > max
  ) {
    throw new Error("Invalid guest counter bounds");
  }

  return (
    <fieldset
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? "guests-error" : undefined}
      className={`min-w-0 space-y-1 border-0 p-0 ${className}`}
    >
      <legend className="font-sans text-label font-semibold text-foreground">
        {label}
      </legend>
      <div className="flex items-center gap-2">
        <Button
          aria-label={`Restar ${label}`}
          size="icon"
          disabled={value === min}
          onClick={() => {
            if (value > min) onChange(value - 1);
          }}
          variant="secondary"
          className="h-6"
        >
          <Icon decorative name="Minus" />
        </Button>
        <output
          aria-atomic="true"
          aria-label={`${label}: ${value}`}
          aria-live="polite"
          role="status"
          className="min-w-7 text-center font-normal text-sm tabular-nums"
        >
          {value}
        </output>
        <Button
          aria-label={`Aumentar ${label}`}
          size="icon"
          disabled={value === max}
          onClick={() => {
            if (value < max) onChange(value + 1);
          }}
          className="h-6"
        >
          <Icon decorative name="Plus" />
        </Button>
      </div>
      {error ? (
        <p
          id="guests-error"
          role="alert"
          className="text-body text-destructive"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
