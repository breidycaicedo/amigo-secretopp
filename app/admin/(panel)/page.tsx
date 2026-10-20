import type { Metadata } from "next";
import { AssignAll } from "@/components/admin/assign-all";
import { ExpectedForm, WishlistToggle } from "@/components/admin/settings-forms";
import { Alert, Badge, ButtonLink, Card, StatTile } from "@/components/ui";
import { getSettings, listParticipants } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/game-rules";
import { buildAdminSummary } from "@/lib/review";

export const metadata: Metadata = { title: "Panel de administración" };

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export default async function AdminDashboard() {
  const [settings, rows] = await Promise.all([getSettings(), listParticipants()]);
  const summary = buildAdminSummary(rows, settings.expected_participants);
  const open = settings.status === "REGISTRATION_OPEN";
  const assigned = settings.status === "ASSIGNED";

  let registrationNotice: { tone: "pine" | "amber"; text: string } | null = null;
  if (summary.missing !== null) {
    if (summary.missing > 0) {
      registrationNotice = {
        tone: "amber",
        text: `⚠️ Faltan ${summary.missing} participante${summary.missing === 1 ? "" : "s"}.`,
      };
    } else if (summary.missing === 0) {
      registrationNotice = { tone: "pine", text: "✅ Todos los participantes están registrados." };
    } else {
      registrationNotice = {
        tone: "amber",
        text: `⚠️ Hay ${-summary.missing} participante${summary.missing === -1 ? "" : "s"} más de los esperados. Revisa la lista.`,
      };
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Card className="animate-rise">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-semibold text-berry-800">🎁 Amigo Secreto</h1>
              <p className="text-muted">Panel de administración</p>
            </div>
            <Badge tone={assigned ? "pine" : open ? "gold" : "amber"}>Estado: {STATUS_LABELS[settings.status]}</Badge>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              label="Registrados"
              value={summary.expected === null ? summary.registered : `${summary.registered} / ${summary.expected}`}
              tone="berry"
            />
            <StatTile label="Esperados" value={summary.expected ?? "—"} />
            <StatTile label="Faltan" value={summary.missing === null ? "—" : Math.max(summary.missing, 0)} tone="amber" />
            <StatTile label="Asignaciones existentes" value={summary.existing} tone="gold" />
            <StatTile label="Por resolver" value={summary.toResolve} tone="neutral" />
            <StatTile
              label="Papelitos por revisar"
              value={summary.unresolvedReferences + summary.unconfirmedLinks}
              tone={summary.unresolvedReferences + summary.unconfirmedLinks > 0 ? "amber" : "pine"}
            />
          </div>

          {registrationNotice ? (
            <div className="mt-5">
              <Alert tone={registrationNotice.tone}>{registrationNotice.text}</Alert>
            </div>
          ) : (
            <div className="mt-5">
              <Alert tone="amber">Define la cantidad esperada de participantes para saber cuántos faltan.</Alert>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ButtonLink href="/admin/participantes" variant="secondary">
              Ver participantes
            </ButtonLink>
            <ButtonLink href="/admin/asignaciones" variant="secondary">
              Ver asignaciones
            </ButtonLink>
          </div>
        </Card>

        {open && summary.problems.length > 0 ? (
          <Alert tone="berry" title="⚠️ No existe una combinación válida con las asignaciones actuales.">
            <p>Revisa estos papelitos antes de asignar:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {summary.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {open && summary.problems.length === 0 && summary.unconfirmedLinks > 0 ? (
          <Alert tone="amber" title="Hay papelitos vinculados automáticamente por nombre">
            {summary.unconfirmedLinks === 1
              ? "1 papelito se vinculó"
              : `${summary.unconfirmedLinks} papelitos se vincularon`}{" "}
            por coincidencia de nombre. Puedes confirmarlos en Participantes (no bloquean el sorteo).
          </Alert>
        ) : null}

        <Card className="animate-rise" style={{ animationDelay: "80ms" }}>
          {assigned ? (
            <div className="text-center">
              <p className="font-display text-2xl font-semibold text-pine-700">✅ Sorteo realizado y bloqueado</p>
              <p className="mt-2 text-muted">
                {settings.assignment_completed_at
                  ? `Completado el ${dateFormat.format(new Date(settings.assignment_completed_at))}.`
                  : null}{" "}
                Los participantes ya pueden consultar su amigo secreto.
              </p>
            </div>
          ) : open ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-semibold">Asignación definitiva</h2>
                <p className="mt-1 text-sm text-muted">
                  Nada se asigna automáticamente. Cuando todos estén registrados y revises los papelitos, pulsa el
                  botón. Se conservarán los papelitos existentes y solo se sortearán los huecos.
                </p>
              </div>
              <AssignAll
                summary={{
                  registered: summary.registered,
                  expected: summary.expected,
                  existing: summary.existing,
                  toResolve: summary.toResolve,
                  missing: summary.missing,
                  blockingProblems: summary.problems.length,
                }}
              />
            </div>
          ) : (
            <p className="text-center text-muted">El sorteo se está procesando…</p>
          )}
        </Card>
      </div>

      <aside className="space-y-6">
        <Card className="space-y-6 animate-rise" style={{ animationDelay: "120ms" }}>
          <h2 className="font-display text-xl font-semibold">Configuración</h2>
          <ExpectedForm current={settings.expected_participants} />
          <hr className="border-line" />
          <WishlistToggle allowed={settings.allow_wishlist_edit_after_lock} />
        </Card>
        <Card className="text-sm text-muted animate-rise" style={{ animationDelay: "160ms" }}>
          <h2 className="mb-2 font-display text-lg font-semibold text-ink">¿Cómo funciona?</h2>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Todos se registran e indican si tienen papelito.</li>
            <li>Revisas los papelitos en «Participantes».</li>
            <li>Pulsas «Asignar todos».</li>
            <li>El sistema conserva los papelitos y sortea los faltantes.</li>
            <li>Todo queda bloqueado y cada quien ve su resultado.</li>
          </ol>
        </Card>
      </aside>
    </div>
  );
}
