import Link from "next/link";
import { GiftMark } from "@/components/gift-mark";
import { ButtonLink } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md text-center">
        <div className="relative mx-auto w-fit animate-pop">
          <span className="absolute -inset-6 -z-10 rounded-full bg-gold-300/30 blur-2xl" aria-hidden="true" />
          <GiftMark className="h-28 w-28 drop-shadow-sm" />
        </div>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.35em] text-gold-700 animate-rise">✨ Edición sin papelitos</p>
        <h1
          className="mt-3 font-display text-5xl font-semibold tracking-tight text-berry-800 sm:text-6xl animate-rise"
          style={{ animationDelay: "60ms" }}
        >
          AMIGO SECRETO
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-lg text-muted animate-rise" style={{ animationDelay: "120ms" }}>
          Organiza tu amigo secreto de forma fácil y segura.
        </p>

        <div className="mt-10 space-y-3 animate-rise" style={{ animationDelay: "180ms" }}>
          <ButtonLink href="/registro" size="lg" className="w-full">
            Registrarme
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="lg" className="w-full">
            Ya estoy registrado
          </ButtonLink>
        </div>

        <Link
          href="/admin/login"
          className="mt-8 inline-block rounded-lg px-3 py-2 text-sm font-semibold text-muted underline-offset-4 hover:text-berry-700 hover:underline"
        >
          Administración
        </Link>
      </div>
    </main>
  );
}
