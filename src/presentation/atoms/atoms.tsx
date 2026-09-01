import Image from "next/image";
import Link, { type LinkProps } from "next/link";
import { icons } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
} from "react";

type ClassNameProps = Readonly<{ className?: string }>;

const headingStyles = {
  1: "font-heading text-display font-normal text-foreground",
  2: "font-heading text-title font-normal text-foreground",
  3: "font-heading text-[1.1875rem] font-normal leading-snug text-foreground",
  4: "font-heading text-lg font-normal leading-snug text-foreground",
  5: "font-heading text-[1.0625rem] font-normal leading-snug text-foreground",
  6: "font-heading text-body font-normal text-foreground",
} as const;

export function Heading({
  children,
  className = "",
  level = 2,
}: Readonly<{
  children: ReactNode;
  className?: string;
  level?: keyof typeof headingStyles;
}>) {
  const Tag = `h${level}` as const;
  return (
    <Tag className={`${headingStyles[level]} ${className}`}>{children}</Tag>
  );
}

export function Text({
  children,
  className = "",
  ...props
}: Readonly<HTMLAttributes<HTMLParagraphElement> & ClassNameProps>) {
  return (
    <p
      className={`font-sans text-body text-foreground ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    size?: "default" | "icon";
    variant?: "primary" | "secondary" | "destructive";
  }
>(function Button(
  {
    children,
    className = "",
    loading = false,
    size = "default",
    variant = "primary",
    type = "button",
    disabled,
    ...props
  },
  ref
) {
  const variants = {
    primary:
      "bg-primary text-on-primary hover:bg-primary active:bg-primary dark:bg-gold dark:text-on-gold dark:hover:bg-gold dark:active:bg-gold",
    secondary:
      "border-2 border-primary bg-card text-foreground hover:bg-muted active:bg-muted",
    destructive:
      "bg-destructive text-on-destructive hover:bg-primary active:bg-primary",
  };
  return (
    <button
      ref={ref}
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sm font-sans text-xs font-normal leading-5 transition-colors duration-200 ease-standard disabled:cursor-not-allowed disabled:opacity-60 ${size === "icon" ? "min-w-11 p-3" : "px-4 py-2"} ${variants[variant]} ${className}`}
    >
      {loading && <Spinner decorative />}
      <span>{children}</span>
    </button>
  );
});

export function ActionLink({
  children,
  className = "",
  variant = "text",
  ...props
}: Readonly<
  LinkProps & {
    children: ReactNode;
    className?: string;
    variant?: "text" | "action";
  }
>) {
  const styles =
    variant === "action"
      ? "inline-flex min-h-11 cursor-pointer items-center rounded-md bg-primary px-4 py-2 font-sans text-xs font-normal leading-5 text-on-primary hover:bg-primary active:bg-primary dark:bg-gold dark:text-on-gold dark:hover:bg-gold dark:active:bg-gold"
      : "cursor-pointer font-sans text-xs font-normal leading-5 text-foreground decoration-accent underline-offset-4 hover:text-accent active:text-accent";
  return (
    <Link
      className={`${styles} transition-colors duration-200 ease-standard ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}

export function VistaValleBrand({
  className = "",
}: Readonly<{ className?: string }>) {
  return (
    <Image
      src="/brand/vista-valle-logo.png"
      alt="Vista Valle Lodging House"
      width={244}
      height={238}
      preload
      sizes="96px"
      className={`h-auto w-24 shrink-0 object-contain ${className}`}
    />
  );
}

export function VistaValleBrandWithoutText({
  className = "",
}: Readonly<{ className?: string }>) {
  return (
    <Image
      src="/brand/vista-valle-logo-ST.png"
      alt="Vista Valle Lodging House Logo"
      width={244}
      height={238}
      sizes="96px"
      className={`h-auto w-24 shrink-0 object-contain ${className}`}
    />
  );
}

export function VistaValleBrandWhite({
  className = "",
}: Readonly<{ className?: string }>) {
  return (
    <Image
      src="/brand/vista-valle-logo-white.png"
      alt="Vista Valle Lodging House Logo"
      width={300}
      height={400}
      sizes="128px"
      className={`h-auto w-32 shrink-0 object-contain ${className}`}
    />
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`min-h-11 w-full rounded-md border bg-card px-4 py-3 font-sans text-base text-foreground transition-colors duration-200 ease-standard placeholder:text-muted-foreground focus:border-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground read-only:bg-muted ${className}`}
      {...props}
    />
  );
});

export function Label({
  children,
  className = "",
  required,
  ...props
}: Readonly<LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }>) {
  return (
    <label
      className={`block font-sans text-label font-semibold text-foreground ${className}`}
      {...props}
    >
      {children}
      {required ? <span> (requerido)</span> : null}
    </label>
  );
}

export type IconName = keyof typeof icons;
type IconProps = Readonly<
  | { decorative: true; name: IconName; title?: never; className?: string }
  | { decorative?: false; name: IconName; title: string; className?: string }
>;
export function Icon({
  decorative = false,
  name,
  title,
  className,
}: IconProps) {
  if (!decorative && !title)
    throw new Error("A meaningful icon requires a title");

  const LucideIcon = icons[name];

  if (!LucideIcon) {
    console.error(`Icon "${name}" not found.`);
    return null;
  }

  return (
    <LucideIcon
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
      role={decorative ? undefined : "img"}
      strokeWidth={2}
      className={`size-5 shrink-0 ${className}`}
    />
  );
}

export function Badge({
  children,
  variant = "neutral",
}: Readonly<{
  children: ReactNode;
  variant?: "neutral" | "success" | "warning" | "error";
}>) {
  const styles = {
    neutral: "bg-muted text-foreground",
    success: "border border-primary bg-card text-foreground",
    warning: "bg-accent text-on-accent",
    error: "bg-destructive text-on-destructive",
  };
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 font-sans text-label font-semibold ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

export function Feedback({
  action,
  children,
  title,
  variant = "info",
}: Readonly<{
  action?: ReactNode;
  children: ReactNode;
  title: string;
  variant?: "info" | "success" | "warning" | "error";
}>) {
  const styles: Record<
    "info" | "success" | "warning" | "error",
    { box: string; icon: string; glyph: IconName }
  > = {
    info: {
      box: "border-border bg-muted",
      icon: "text-muted-foreground",
      glyph: "Info",
    },
    success: {
      box: "border-primary/25 bg-card",
      icon: "text-primary",
      glyph: "CircleCheck",
    },
    warning: {
      box: "border-accent/40 bg-accent/10",
      icon: "text-accent",
      glyph: "TriangleAlert",
    },
    error: {
      box: "border-destructive/40 bg-destructive/10",
      icon: "text-destructive",
      glyph: "CircleAlert",
    },
  };
  const style = styles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={`flex gap-3 rounded-md border p-4 ${style.box}`}
    >
      <Icon
        decorative
        name={style.glyph}
        className={`mt-0.5 shrink-0 ${style.icon}`}
      />
      <div>
        <p className="font-sans text-body font-semibold text-foreground">
          {title}
        </p>
        <div className="mt-1 font-sans text-body text-foreground">
          {children}
        </div>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}

export function Spinner({
  decorative = false,
  label = "Cargando",
}: Readonly<{ decorative?: boolean; label?: string }>) {
  return (
    <span
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : label}
      className="inline-flex size-5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
    >
      <span className="sr-only">{decorative ? "" : label}</span>
    </span>
  );
}

/**
 * A pulsing placeholder block sized by `className`, used to reflect the
 * shape of content that is still loading (room cards, a detail layout,
 * availability results). Never use this for a pending button/navigation
 * action - those show their loading state on the control itself (see
 * `Button`'s `loading` prop), not as a page-level placeholder.
 */
export function Skeleton({
  className = "",
}: Readonly<{ className?: string }>) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className}`}
    />
  );
}

export function LoadingState({
  label = "Cargando",
}: Readonly<{ label?: string }>) {
  return (
    <div
      aria-label={label}
      role="status"
      aria-busy="true"
      className="inline-flex min-h-11 items-center gap-2 font-sans text-body text-muted-foreground"
    >
      <Spinner decorative />
      <span>{label}</span>
    </div>
  );
}
