import type {
  ChangeEventHandler,
  ComponentProps,
  InputEventHandler,
} from "react";

import {
  Badge,
  Icon,
  Input,
  Label,
  Text,
  type IconName,
} from "@/presentation/atoms";

type FormFieldProps = Readonly<{
  id: string;
  label: string;
  hint?: string;
  error?: string;
  errorClassName?: string;
  reserveMessageSpace?: boolean;
  required?: boolean;
  inputProps?: ComponentProps<typeof Input>;
}>;

function describedByTokens(value?: string) {
  return value?.trim().split(/\s+/).filter(Boolean) ?? [];
}

export function FormField({
  id,
  label,
  hint,
  error,
  errorClassName,
  reserveMessageSpace = false,
  required,
  inputProps,
}: FormFieldProps) {
  const describedBy = [
    ...new Set([
      ...describedByTokens(inputProps?.["aria-describedby"]),
      ...(hint ? [`${id}-hint`] : []),
      ...(error ? [`${id}-error`] : []),
    ]),
  ].join(" ");

  return (
    <div className={`${reserveMessageSpace ? "relative " : ""}space-y-2`}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Input
        {...inputProps}
        id={id}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : inputProps?.["aria-invalid"]}
        required={required || inputProps?.required}
      />
      <div
        className={
          reserveMessageSpace
            ? "laptop:absolute laptop:inset-x-0 laptop:top-full laptop:z-10 laptop:mt-2 laptop:rounded-md laptop:bg-card laptop:px-1 laptop:py-1"
            : undefined
        }
      >
        {hint ? (
          <Text id={`${id}-hint`} className="text-foreground">
            {hint}
          </Text>
        ) : null}
        {error ? (
          <p
            id={`${id}-error`}
            role="alert"
            className={`text-body text-destructive ${errorClassName ?? ""}`}
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type DateFieldProps = Omit<FormFieldProps, "inputProps"> &
  Readonly<{
    value?: string;
    defaultValue?: string;
    min?: string;
    max?: string;
    name?: string;
    readOnly?: boolean;
    inputClassName?: string;
    onChange?: ChangeEventHandler<HTMLInputElement>;
    onInput?: InputEventHandler<HTMLInputElement>;
  }>;

export function DateField({
  value,
  defaultValue,
  min,
  max,
  name,
  readOnly,
  inputClassName,
  onChange,
  onInput,
  ...field
}: DateFieldProps) {
  if (value !== undefined && defaultValue !== undefined) {
    throw new Error("DateField cannot receive both value and defaultValue");
  }
  if (value !== undefined && !readOnly && !onChange) {
    throw new Error("A controlled DateField requires onChange or readOnly");
  }

  return (
    <FormField
      {...field}
      inputProps={{
        type: "date",
        value,
        defaultValue,
        min,
        max,
        name,
        readOnly,
        onChange,
        onInput,
        className: `px-3 py-2 text-sm ${inputClassName ?? ""}`,
      }}
    />
  );
}

export function Price({
  amount,
  label,
  suffix,
  className,
}: Readonly<{ amount: number; label?: string; suffix?: string; className?: string }>) {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("Price must be a non-negative CLP integer");
  }
  return (
    <p className={`font-sans text-body text-foreground ${className ?? ""}`}>
      {label ? `${label}: ` : ""}
      <data value={String(amount)} className="tabular-nums font-semibold">
        {new Intl.NumberFormat("es-CL", {
          style: "currency",
          currency: "CLP",
          maximumFractionDigits: 0,
        }).format(amount)}
      </data>
      {suffix ? ` ${suffix}` : ""}
    </p>
  );
}

export function Amenities({
  items,
}: Readonly<{ items: readonly { id: string; label: string }[] }>) {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[#B6976D] text-[#B6976D]">
            <Icon decorative name="Check" className="size-3.5" />
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export type ContactHref =
  | `tel:${string}`
  | `mailto:${string}`
  | `https://${string}`;

function isValidContactHref(href: string) {
  if (href.startsWith("tel:")) {
    return /^tel:\+?[0-9(). -]+$/.test(href) && href.slice(4).trim().length > 0;
  }
  if (href.startsWith("mailto:")) {
    const address = href.slice(7).split("?", 1)[0];
    return /^[^\s@]+@[^\s@]+$/.test(address);
  }
  try {
    const url = new URL(href);
    return (
      url.protocol === "https:" &&
      url.hostname.length > 0 &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function ContactLink({
  href,
  children,
  icon = "ArrowRight",
}: Readonly<{ href: ContactHref; children: string; icon?: IconName }>) {
  if (!children.trim() || !isValidContactHref(href)) {
    throw new Error("Unsupported contact link");
  }
  return (
    <a
      href={href}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-0 py-2 font-normal text-xs text-on-primary/75 decoration-accent underline-offset-4 text-left"
    >
      <Icon decorative name={icon} />
      {children}
    </a>
  );
}

export function ChatMessageBubble({
  author,
  children,
  role,
}: Readonly<{
  author: string;
  children: string;
  role: "assistant" | "user";
}>) {
  return (
    <div
      className={`flex flex-col gap-1 ${role === "user" ? "items-end" : "items-start"}`}
    >
      <Text className="text-xs text-muted-foreground">{author}</Text>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-3 font-sans text-base ${
          role === "user"
            ? "bg-primary text-on-primary"
            : "border bg-card text-foreground"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

type QuotationStepStatus = "active" | "completed" | "upcoming";

const quotationStepStyles: Record<QuotationStepStatus, string> = {
  active: "border-primary bg-primary text-on-primary",
  completed: "border-primary bg-card text-foreground",
  upcoming: "border-border bg-muted text-muted-foreground",
};

/**
 * Persistent progress indicator for the company quotation flow's four
 * sections. The flow itself stays a single page with conditional sections
 * (no step routing); this only reflects, never drives, which section is
 * currently reachable given state the caller already tracks.
 */
export function QuotationProgress({
  activeIndex,
  steps,
}: Readonly<{ activeIndex: number; steps: readonly string[] }>) {
  return (
    <nav
      aria-label="Progreso de la cotización"
      className="vv-quotation-progress"
    >
      <Text className="text-sm font-semibold text-foreground tablet:hidden">
        Paso {activeIndex + 1} de {steps.length}: {steps[activeIndex]}
      </Text>
      <ol className="hidden flex-wrap items-center gap-2 tablet:flex">
        {steps.map((label, index) => {
          const status: QuotationStepStatus =
            index === activeIndex
              ? "active"
              : index < activeIndex
                ? "completed"
                : "upcoming";
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={status === "active" ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${quotationStepStyles[status]}`}
              >
                <span aria-hidden="true">{index + 1}</span>
                <span>{label}</span>
              </span>
              {index < steps.length - 1 ? (
                <span aria-hidden="true" className="h-px w-6 bg-border" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Visual dot meter for guest-allocation progress: one dot per person in the
 * quotation's total, filled as rooms are added. The sentence-form summary
 * (e.g. "4 de 6 personas asignadas") stays available to assistive tech via
 * `aria-label` on the live region instead of being the primary visible cue.
 */
export function GuestAllocationMeter({
  assigned,
  label,
  total,
}: Readonly<{ assigned: number; label: string; total: number }>) {
  return (
    <div
      aria-atomic="true"
      aria-label={label}
      aria-live="polite"
      className="flex flex-wrap items-center gap-1.5"
      role="status"
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`size-3.5 rounded-full border-2 ${
            index < assigned
              ? "border-primary bg-primary"
              : "border-border bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

export function StatusPresentation({
  label,
  description,
  tone = "neutral",
}: Readonly<{
  label: string;
  description?: string;
  tone?: "neutral" | "success" | "warning" | "error";
}>) {
  return (
    <div className="space-y-1">
      <Badge variant={tone}>{label}</Badge>
      {description ? (
        <Text className="text-muted-foreground">{description}</Text>
      ) : null}
    </div>
  );
}
