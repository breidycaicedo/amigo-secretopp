import type { Metadata } from "next";
import { RegistrationForm } from "@/components/forms/registration-form";
import { PageShell } from "@/components/page-shell";
import { Alert, ButtonLink } from "@/components/ui";
import { getSettings } from "@/lib/data";
import { canRegister } from "@/lib/game-rules";

export const metadata: Metadata = { title: "Registro" };
export const dynamic = "force-dynamic";

export default async function RegistrationPage() {
  const settings = await getSettings();
  return (
    <PageShell>
      <div className="mb-6 animate-rise">
        <h1 className="font-display text-3xl font-semibold text-berry-800 sm:text-4xl">🎁 Amigo Secreto</h1>
        <p className="mt-2 text-muted">Registra tus datos para participar</p>
      </div>
      {canRegister(settings.status) ? (
        <RegistrationForm />
      ) : (
        <div className="space-y-4">
          <Alert tone="amber" title="El registro está cerrado">
            La administradora ya realizó el sorteo. Si ya estabas registrado, entra para ver tu amigo secreto.
          </Alert>
          <ButtonLink href="/login" className="w-full">
            Ya estoy registrado
          </ButtonLink>
        </div>
      )}
    </PageShell>
  );
}
