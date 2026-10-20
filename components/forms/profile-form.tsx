"use client";

import { useActionState, useState } from "react";
import { updateProfileAction } from "@/app/actions/participant";
import type { ActionState } from "@/types/domain";
import { NAME_MAX, WISHLIST_MAX } from "@/lib/validation";
import { SubmitButton } from "../submit-button";
import { Alert, Field, inputClasses } from "../ui";
import { PaperFields, type PaperState } from "./paper-fields";

const INITIAL: ActionState = { ok: false };

export type ProfileDefaults = {
  name: string;
  wishlist: string;
  hasPaper: boolean;
  targetName: string;
  targetId: string;
};

/**
 * Edición de datos. mode="full" con el registro abierto;
 * mode="wishlist" cuando el sorteo ya se hizo y la administradora lo permite.
 */
export function ProfileForm({ defaults, mode }: { defaults: ProfileDefaults; mode: "full" | "wishlist" }) {
  const [state, formAction] = useActionState(updateProfileAction, INITIAL);
  const [name, setName] = useState(defaults.name);
  const [wishlist, setWishlist] = useState(defaults.wishlist);
  const [paper, setPaper] = useState<PaperState>({
    hasPaper: defaults.hasPaper ? "yes" : "no",
    target: { name: defaults.targetName, id: defaults.targetId, unregistered: false },
  });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {mode === "full" ? (
        <Field label="Nombre completo" htmlFor="name" error={errors.name}>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX}
            aria-invalid={errors.name ? true : undefined}
            className={inputClasses}
          />
        </Field>
      ) : null}

      <Field label="Lista de deseos" htmlFor="wishlist" error={errors.wishlist} hint="Una idea por línea.">
        <textarea
          id="wishlist"
          name="wishlist"
          rows={5}
          value={wishlist}
          onChange={(event) => setWishlist(event.target.value)}
          maxLength={WISHLIST_MAX}
          className={`${inputClasses} resize-y leading-relaxed`}
        />
      </Field>

      {mode === "full" ? <PaperFields value={paper} onChange={setPaper} candidates={state.candidates} errors={errors} /> : null}

      {state.message ? <Alert tone={state.ok ? "pine" : "berry"}>{state.message}</Alert> : null}

      <SubmitButton className="w-full sm:w-auto" pendingText="Guardando…">
        Guardar cambios
      </SubmitButton>
    </form>
  );
}
