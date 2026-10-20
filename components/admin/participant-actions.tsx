"use client";

import { useActionState, useState } from "react";
import { deleteParticipantAction, linkReferenceAction } from "@/app/actions/admin";
import type { ActionState, PersonOption } from "@/types/domain";
import { SubmitButton } from "../submit-button";
import { buttonClasses, inputClasses } from "../ui";

const INITIAL: ActionState = { ok: false };

function Message({ state }: { state: ActionState }) {
  if (state.message === undefined) {
    return null;
  }
  return <p className={`text-xs font-medium ${state.ok ? "text-pine-700" : "text-berry-600"}`}>{state.message}</p>;
}

/** Vincular/confirmar a quién se refiere el papelito de un participante. */
export function LinkReferenceForm({
  participantId,
  currentTargetId,
  suggestions,
  people,
}: {
  participantId: string;
  currentTargetId: string | null;
  suggestions: PersonOption[];
  people: PersonOption[];
}) {
  const [state, formAction] = useActionState(linkReferenceAction, INITIAL);
  const suggestedIds = new Set(suggestions.map((person) => person.id));
  const initial = currentTargetId ?? (suggestions.length === 1 ? suggestions[0].id : "");
  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="participantId" value={participantId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <select name="targetId" defaultValue={initial} className={`${inputClasses} py-2 text-sm`} aria-label="Persona del papelito">
          <option value="">— Sin vincular —</option>
          {suggestions.length > 0 ? (
            <optgroup label="Coincidencias">
              {suggestions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Todos">
            {people
              .filter((person) => person.id !== participantId && !suggestedIds.has(person.id))
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
          </optgroup>
        </select>
        <SubmitButton variant="secondary" size="sm" pendingText="…">
          Confirmar
        </SubmitButton>
      </div>
      <Message state={state} />
    </form>
  );
}

export function DeleteParticipantButton({ participantId, name }: { participantId: string; name: string }) {
  const [state, formAction] = useActionState(deleteParticipantAction, INITIAL);
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={buttonClasses("ghost", "sm")}>
        Eliminar
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 animate-fade">
      <input type="hidden" name="participantId" value={participantId} />
      <span className="text-xs text-muted">¿Eliminar a {name}?</span>
      <SubmitButton variant="danger" size="sm" pendingText="…">
        Sí, eliminar
      </SubmitButton>
      <button type="button" onClick={() => setAsking(false)} className={buttonClasses("ghost", "sm")}>
        No
      </button>
      <Message state={state} />
    </form>
  );
}
