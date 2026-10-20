"use client";

import { useActionState } from "react";
import { setExpectedParticipantsAction, setWishlistEditingAction } from "@/app/actions/admin";
import type { ActionState } from "@/types/domain";
import { SubmitButton } from "../submit-button";
import { inputClasses } from "../ui";

const INITIAL: ActionState = { ok: false };

function Feedback({ state }: { state: ActionState }) {
  const text = state.fieldErrors?.expected ?? state.message;
  if (text === undefined) {
    return null;
  }
  return (
    <p role="status" className={`text-sm font-medium ${state.ok ? "text-pine-700" : "text-berry-600"}`}>
      {text}
    </p>
  );
}

export function ExpectedForm({ current }: { current: number | null }) {
  const [state, formAction] = useActionState(setExpectedParticipantsAction, INITIAL);
  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor="expected" className="block text-sm font-semibold">
        Cantidad esperada de participantes
      </label>
      <div className="flex gap-2">
        <input
          id="expected"
          name="expected"
          type="number"
          inputMode="numeric"
          min={2}
          max={1000}
          defaultValue={current ?? ""}
          key={current ?? "none"}
          placeholder="Ej. 15"
          className={`${inputClasses} max-w-32`}
        />
        <SubmitButton variant="secondary" pendingText="…">
          Guardar
        </SubmitButton>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function WishlistToggle({ allowed }: { allowed: boolean }) {
  const [state, formAction] = useActionState(setWishlistEditingAction, INITIAL);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="allow" value={allowed ? "" : "1"} />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Editar listas de deseos después del sorteo</p>
          <p className="text-xs text-muted">{allowed ? "Permitido" : "Bloqueado"} · solo afecta la lista de deseos.</p>
        </div>
        <SubmitButton variant={allowed ? "danger" : "secondary"} size="sm" pendingText="…">
          {allowed ? "Bloquear" : "Permitir"}
        </SubmitButton>
      </div>
      <Feedback state={state} />
    </form>
  );
}
