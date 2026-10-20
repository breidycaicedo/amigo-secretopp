import type { Metadata } from "next";
import { Reveal } from "@/components/admin/reveal";
import { Badge, Card } from "@/components/ui";
import { getSettings, listAssignments, listParticipants } from "@/lib/data";

export const metadata: Metadata = { title: "Asignaciones" };

export default async function AssignmentsPage() {
  const settings = await getSettings();

  if (settings.status !== "ASSIGNED") {
    const rows = await listParticipants();
    const names = new Map(rows.map((row) => [row.id, row.name]));
    const reported = rows.filter((row) => row.has_existing_assignment);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-berry-800">Asignaciones</h1>
          <p className="text-muted">Aún no se ha realizado el sorteo. Estos son los papelitos reportados hasta ahora.</p>
        </div>
        <Card>
          {reported.length === 0 ? (
            <p className="text-center text-muted">Nadie ha reportado papelitos todavía.</p>
          ) : (
            <Reveal>
              <ul className="divide-y divide-line">
                {reported.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span>
                      <strong>{row.name}</strong> <span className="text-muted">→</span>{" "}
                      {row.reported_target_id ? names.get(row.reported_target_id) : row.reported_target_name}
                    </span>
                    <Badge tone={row.reported_target_id ? "gold" : "amber"}>
                      {row.reported_target_id ? "Reportada" : "Sin vincular"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </Card>
      </div>
    );
  }

  const assignments = await listAssignments();
  const existing = assignments.filter((assignment) => assignment.source === "EXISTING").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-berry-800">Asignaciones</h1>
        <p className="text-muted">
          Información completamente privada · {existing} papelito{existing === 1 ? "" : "s"} conservado
          {existing === 1 ? "" : "s"} y {assignments.length - existing} generada
          {assignments.length - existing === 1 ? "" : "s"} por sorteo.
        </p>
      </div>
      <Card>
        <Reveal>
          <ul className="divide-y divide-line">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-[15px]">
                  <strong>{assignment.giverName}</strong> <span className="text-berry-500">→</span> {assignment.receiverName}
                </span>
                <Badge tone={assignment.source === "EXISTING" ? "gold" : "berry"}>
                  {assignment.source === "EXISTING" ? "Papelito" : "Sorteo"}
                </Badge>
              </li>
            ))}
          </ul>
        </Reveal>
      </Card>
    </div>
  );
}
