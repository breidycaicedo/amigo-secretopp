import type { Metadata } from "next";
import { DeleteParticipantButton, LinkReferenceForm } from "@/components/admin/participant-actions";
import { Badge, Card } from "@/components/ui";
import { getSettings, listParticipants } from "@/lib/data";
import { REVIEW_LABELS, buildAdminSummary, type ParticipantReview } from "@/lib/review";
import type { ParticipantReviewStatus, PersonOption } from "@/types/domain";

export const metadata: Metadata = { title: "Participantes" };

const STATUS_TONES: Record<ParticipantReviewStatus, "pine" | "amber" | "berry" | "gold" | "neutral"> = {
  OK: "pine",
  PENDING: "neutral",
  UNRESOLVED_REFERENCE: "amber",
  NEEDS_REVIEW: "gold",
  CONFLICT: "berry",
};

function Reported({ review }: { review: ParticipantReview }) {
  if (!review.hasPaper) {
    return <span className="text-muted">—</span>;
  }
  const differs = review.linkedName !== null && review.reportedName !== review.linkedName;
  return (
    <span>
      {review.linkedName ?? review.reportedName}
      {differs ? <span className="block text-xs text-muted">Escribió: «{review.reportedName}»</span> : null}
      {review.linkedName === null ? <span className="block text-xs text-amber-700">Aún no registrada</span> : null}
    </span>
  );
}

function Actions({ review, open, people }: { review: ParticipantReview; open: boolean; people: PersonOption[] }) {
  if (!open) {
    return null;
  }
  return (
    <div className="space-y-2">
      {review.hasPaper && review.status !== "OK" ? (
        <LinkReferenceForm
          participantId={review.id}
          currentTargetId={review.linkedId}
          suggestions={review.suggestions}
          people={people}
        />
      ) : null}
      <DeleteParticipantButton participantId={review.id} name={review.name} />
    </div>
  );
}

export default async function ParticipantsPage() {
  const [settings, rows] = await Promise.all([getSettings(), listParticipants()]);
  const summary = buildAdminSummary(rows, settings.expected_participants);
  const open = settings.status === "REGISTRATION_OPEN";
  const people: PersonOption[] = rows
    .map((row) => ({ id: row.id, name: row.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-berry-800">Participantes</h1>
          <p className="text-muted">
            {summary.registered} registrado{summary.registered === 1 ? "" : "s"}
            {summary.expected !== null ? ` de ${summary.expected} esperados` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge tone="pine">OK: papelito confirmado</Badge>
          <Badge tone="gold">Verificar: vinculado por nombre</Badge>
          <Badge tone="amber">Sin vincular</Badge>
          <Badge tone="berry">Conflicto: persona repetida</Badge>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="text-center text-muted">Todavía no hay participantes registrados.</Card>
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <div className="space-y-3 md:hidden">
            {summary.reviews.map((review) => (
              <Card key={review.id} className="space-y-3 p-4!">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{review.name}</p>
                    <p className="font-mono text-xs text-muted">{review.studentCode}</p>
                  </div>
                  <Badge tone={STATUS_TONES[review.status]}>{REVIEW_LABELS[review.status]}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted">Tiene papelito</dt>
                  <dd>{review.hasPaper ? "Sí" : "No"}</dd>
                  <dt className="text-muted">Persona reportada</dt>
                  <dd>
                    <Reported review={review} />
                  </dd>
                </dl>
                {review.wishlist ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold text-berry-700">Lista de deseos</summary>
                    <p className="mt-2 whitespace-pre-line text-muted">{review.wishlist}</p>
                  </details>
                ) : null}
                <Actions review={review} open={open} people={people} />
              </Card>
            ))}
          </div>

          {/* Escritorio: tabla */}
          <Card className="hidden overflow-x-auto p-0! md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-cream/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Nombre</th>
                  <th className="px-5 py-3 font-semibold">Código</th>
                  <th className="px-5 py-3 font-semibold">Tiene papelito</th>
                  <th className="px-5 py-3 font-semibold">Persona reportada</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                  {open ? <th className="px-5 py-3 font-semibold">Acciones</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summary.reviews.map((review) => (
                  <tr key={review.id} className="align-top transition hover:bg-cream/40">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{review.name}</p>
                      {review.wishlist ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-semibold text-berry-700">Lista de deseos</summary>
                          <p className="mt-1 max-w-xs whitespace-pre-line text-xs text-muted">{review.wishlist}</p>
                        </details>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">{review.studentCode}</td>
                    <td className="px-5 py-4">{review.hasPaper ? "Sí" : "No"}</td>
                    <td className="px-5 py-4">
                      <Reported review={review} />
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={STATUS_TONES[review.status]}>{REVIEW_LABELS[review.status]}</Badge>
                    </td>
                    {open ? (
                      <td className="w-80 px-5 py-4">
                        <Actions review={review} open={open} people={people} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
