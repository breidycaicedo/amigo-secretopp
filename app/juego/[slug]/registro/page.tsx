import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegistrationForm } from "@/components/forms/registration-form";
import { PageShell } from "@/components/page-shell";
import { Alert, ButtonLink } from "@/components/ui";
import { getGameBySlug, getSettings } from "@/lib/data";
import { canRegister } from "@/lib/game-rules";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  return { title: game ? `Registro · ${game.name}` : "Registro" };
}

export default async function RegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (game === null) {
    notFound();
  }
  const settings = await getSettings(game.id);
  return (
    <PageShell>
      <div className="mb-6 animate-rise">
        <h1 className="font-display text-3xl font-semibold text-berry-800 sm:text-4xl">🎁 {game.name}</h1>
        <p className="mt-2 text-muted">Registra tus datos para participar</p>
      </div>
      {canRegister(settings.status) ? (
        <RegistrationForm gameId={game.id} />
      ) : (
        <div className="space-y-4">
          <Alert tone="amber" title="El registro está cerrado">
            La administradora ya realizó el sorteo. Si ya estabas registrado, entra para ver tu amigo secreto.
          </Alert>
          <ButtonLink href={`/juego/${game.slug}/login`} className="w-full">
            Ya estoy registrado
          </ButtonLink>
        </div>
      )}
    </PageShell>
  );
}
