"use client";

import { useActionState } from "react";
import { createGameAction } from "@/app/actions/admin";
import type { ActionState } from "@/types/domain";
import { SubmitButton } from "../submit-button";
import { Field, inputClasses } from "../ui";

const INITIAL: ActionState = { ok: false };

export function CreateGameForm() {
  const [state, formAction] = useActionState(createGameAction, INITIAL);
  return (
    <form action={formAction} className="space-y-3">
      <Field label="Nombre del juego" htmlFor="game-name" error={state.fieldErrors?.name} hint="Ej. Grupo 8, Familia Caicedo, Oficina">
        <input
          id="game-name"
          name="name"
          maxLength={60}
          placeholder="Ej. Grupo 8"
          aria-invalid={state.fieldErrors?.name ? true : undefined}
          className={inputClasses}
        />
      </Field>
      {state.message ? <p className="text-sm font-medium text-berry-600">{state.message}</p> : null}
      <SubmitButton size="lg" className="w-full" pendingText="Creando…">
        Crear juego
      </SubmitButton>
    </form>
  );
}
