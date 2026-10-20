import { PageShell } from "@/components/page-shell";
import { ButtonLink, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <PageShell>
      <Card className="text-center">
        <p className="font-display text-6xl font-semibold text-berry-200">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-berry-800">Página no encontrada</h1>
        <p className="mt-3 text-muted">Este regalo no está debajo del árbol.</p>
        <ButtonLink href="/" className="mt-6">
          Volver al inicio
        </ButtonLink>
      </Card>
    </PageShell>
  );
}
