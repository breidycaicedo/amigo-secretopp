import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GiftMark } from "@/components/gift-mark";
import { ButtonLink } from "@/components/ui";
import { getGameBySlug, getSettings } from "@/lib/data";
import { canRegister } from "@/lib/game-rules";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  return { title: game ? `Amigo Secreto · ${game.name}` : "Amigo Secreto" };
}

export default async function GameHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (game === null) {
    notFound();
  }
  const settings = await getSettings(game.id);
  const open = canRegister(settings.status);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md text-center">
        <div className="relative mx-auto w-fit animate-pop">
          <GiftMark className="h-24 w-24 drop-shadow-sm" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.35em] text-gold-700 animate-rise">Amigo secreto</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-berry-800 animate-rise" style={{ animationDelay: "60ms" }}>
          {game.name}
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-muted animate-rise" style={{ animationDelay: "120ms" }}>
          {open
            ? "Regístrate para participar o entra si ya lo hiciste."
            : "El sorteo ya se realizó. Si ya estabas registrado, entra para ver tu amigo secreto."}
        </p>
        <div className="mt-10 space-y-3 animate-rise" style={{ animationDelay: "180ms" }}>
          {open ? (
            <ButtonLink href={`/juego/${game.slug}/registro`} size="lg" className="w-full">
              Registrarme
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/juego/${game.slug}/login`} variant={open ? "secondary" : "primary"} size="lg" className="w-full">
            Ya estoy registrado
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
