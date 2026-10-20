import Link from "next/link";
import type { ReactNode } from "react";
import { GiftMark } from "./gift-mark";
import { cx } from "./ui";

/** Contenedor de página: mobile-first, con barra superior opcional. */
export function PageShell({
  children,
  width = "narrow",
  actions,
  label,
}: {
  children: ReactNode;
  width?: "narrow" | "wide";
  actions?: ReactNode;
  label?: string;
}) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
        <Link href="/" className="group flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-berry-600">
          <GiftMark className="h-9 w-9 transition-transform group-hover:-rotate-6" />
          <span className="font-display text-lg font-semibold tracking-tight text-berry-800">
            Amigo Secreto
            {label ? <span className="ml-2 align-middle text-xs font-sans font-semibold uppercase tracking-widest text-gold-700">{label}</span> : null}
          </span>
        </Link>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      <main className={cx("mx-auto px-4 pb-16 pt-6 sm:px-6 sm:pt-10", width === "narrow" ? "max-w-xl" : "max-w-5xl")}>
        {children}
      </main>
    </div>
  );
}
