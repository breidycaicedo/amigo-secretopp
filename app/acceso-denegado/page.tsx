import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { ButtonLink, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Acceso denegado" };

export default function ForbiddenPage() {
  return (
    <PageShell>
      <Card className="text-center animate-rise">
        <p className="font-display text-6xl font-semibold text-berry-200">403</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-berry-800">Acceso denegado</h1>
        <p className="mt-3 text-muted">Esta sección es exclusiva de la administradora del juego.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href="/mi-cuenta">Ir a mi cuenta</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Inicio
          </ButtonLink>
        </div>
      </Card>
    </PageShell>
  );
}
