import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Primitivas visuales compartidas (sin estado, válidas en servidor y cliente). */

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-berry-600 text-white shadow-lift hover:bg-berry-700 active:bg-berry-800 focus-visible:outline-berry-600",
  secondary:
    "bg-paper text-ink ring-1 ring-line shadow-soft hover:ring-berry-200 hover:bg-white focus-visible:outline-berry-600",
  ghost: "text-berry-700 hover:bg-berry-50 focus-visible:outline-berry-600",
  danger: "bg-white text-berry-700 ring-1 ring-berry-200 hover:bg-berry-50 focus-visible:outline-berry-600",
  gold: "bg-gold-500 text-ink shadow-lift hover:bg-gold-300 focus-visible:outline-gold-700",
};

export function buttonClasses(variant: Variant = "primary", size: "md" | "lg" | "sm" = "md"): string {
  const sizes = {
    sm: "h-9 px-3.5 text-sm rounded-xl",
    md: "h-12 px-5 text-[15px] rounded-2xl",
    lg: "h-14 px-6 text-base rounded-2xl",
  };
  return cx(
    "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    "active:scale-[0.98]",
    sizes[size],
    VARIANTS[variant],
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: "md" | "lg" | "sm";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(buttonClasses(variant, size), className)}>
      {children}
    </Link>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-3xl bg-paper p-5 shadow-soft ring-1 ring-line sm:p-7", className)} {...rest}>
      {children}
    </section>
  );
}

type Tone = "neutral" | "berry" | "gold" | "pine" | "amber";

const TONES: Record<Tone, string> = {
  neutral: "bg-cream text-muted ring-line",
  berry: "bg-berry-50 text-berry-700 ring-berry-100",
  gold: "bg-gold-100 text-gold-700 ring-gold-300/50",
  pine: "bg-pine-50 text-pine-700 ring-pine-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-700/20",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", TONES[tone])}>
      {children}
    </span>
  );
}

export function Alert({
  tone = "berry",
  title,
  children,
}: {
  tone?: Exclude<Tone, "neutral">;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div role={tone === "berry" ? "alert" : "status"} className={cx("animate-fade rounded-2xl px-4 py-3 text-sm ring-1", TONES[tone])}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : undefined}>{children}</div> : null}
    </div>
  );
}

export const inputClasses = cx(
  "block w-full rounded-2xl border-0 bg-white px-4 py-3 text-[16px] text-ink shadow-sm ring-1 ring-line",
  "placeholder:text-muted/60 transition focus:outline-none focus:ring-2 focus:ring-berry-500",
  "aria-[invalid=true]:ring-berry-500 aria-[invalid=true]:bg-berry-50/40",
);

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm font-medium text-berry-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function StatTile({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className={cx("rounded-2xl px-4 py-3 ring-1", TONES[tone])}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
