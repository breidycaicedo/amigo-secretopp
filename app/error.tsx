"use client";

import { PageShell } from "@/components/page-shell";
import { Card, buttonClasses } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageShell>
      <Card className="text-center">
        <h1 className="font-display text-2xl font-semibold text-berry-800">Algo salió mal</h1>
        <p className="mt-3 text-muted">
          No pudimos cargar esta página. Puede ser un problema de conexión o de la base de datos. Intenta de nuevo en
          unos segundos.
        </p>
        <button type="button" onClick={reset} className={`${buttonClasses("primary")} mt-6`}>
          Reintentar
        </button>
      </Card>
    </PageShell>
  );
}
