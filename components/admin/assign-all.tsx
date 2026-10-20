"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { runAssignmentAction } from "@/app/actions/admin";
import type { ActionState } from "@/types/domain";
import { SubmitButton } from "../submit-button";
import { Alert, buttonClasses } from "../ui";

const INITIAL: ActionState = { ok: false };

export type AssignSummary = {
  registered: number;
  expected: number | null;
  existing: number;
  toResolve: number;
  missing: number | null;
  blockingProblems: number;
};

/** Botón "ASIGNAR TODOS" con modal de confirmación (y confirmación extra si faltan personas). */
export function AssignAll({ summary }: { summary: AssignSummary }) {
  const [state, formAction] = useActionState(runAssignmentAction, INITIAL);
  const [open, setOpen] = useState(false);
  const [extraConfirmed, setExtraConfirmed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const incomplete = summary.missing === null || summary.missing > 0;
  const blocked = summary.blockingProblems > 0 || summary.registered < 2;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (state.message !== undefined) {
      setOpen(false);
      setExtraConfirmed(false);
    }
  }, [state]);

  const row = (label: string, value: string | number) => (
    <div className="flex items-center justify-between py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-display text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );

  return (
    <div className="space-y-4">
      {state.message ? (
        <Alert tone={state.ok ? "pine" : "berry"} title={state.message}>
          {state.details && state.details.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {state.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={blocked}
        className={`${buttonClasses("primary", "lg")} w-full text-lg tracking-wide`}
      >
        🎁 ASIGNAR TODOS
      </button>
      {blocked ? (
        <p className="text-center text-sm text-muted">
          {summary.registered < 2
            ? "Se necesitan al menos 2 participantes."
            : "Resuelve los problemas de arriba para poder asignar."}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto w-[min(92vw,30rem)] rounded-3xl bg-paper p-0 text-ink shadow-lift backdrop:bg-ink/40 backdrop:backdrop-blur-sm open:animate-pop"
      >
        <form action={formAction} className="space-y-5 p-6 sm:p-7">
          <input type="hidden" name="confirm" value="1" />
          <input type="hidden" name="confirmMissing" value={extraConfirmed ? "1" : ""} />
          <div>
            <h2 className="font-display text-2xl font-semibold text-berry-800">¿Confirmar asignaciones?</h2>
            <p className="mt-2 text-sm text-muted">
              ¿Estás segura de que todos los participantes están registrados? Esta acción procesará las asignaciones
              pendientes y bloqueará el resultado. <strong className="text-ink">No se puede deshacer.</strong>
            </p>
          </div>

          <dl className="divide-y divide-line rounded-2xl bg-white px-4 ring-1 ring-line">
            {row("Participantes registrados", summary.registered)}
            {row("Esperados", summary.expected ?? "Sin definir")}
            {row("Asignaciones existentes", summary.existing)}
            {row("Asignaciones pendientes", summary.toResolve)}
          </dl>

          {incomplete ? (
            <div className="space-y-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-700/20">
              <p className="text-sm font-semibold text-amber-700">
                {summary.missing === null
                  ? "⚠️ No has definido la cantidad esperada de participantes."
                  : "⚠️ Todavía faltan participantes por registrarse."}
              </p>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={extraConfirmed}
                  onChange={(event) => setExtraConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-berry-600"
                />
                Entiendo que quienes no se hayan registrado quedarán por fuera del sorteo y quiero continuar.
              </label>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} className={buttonClasses("secondary")}>
              Cancelar
            </button>
            <SubmitButton pendingText="Asignando…" disabled={incomplete && !extraConfirmed}>
              Asignar todos
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </div>
  );
}
