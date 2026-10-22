"use client";

import { useActionState, useState } from "react";
import { registerAction } from "@/app/actions/participant";
import type { ActionState } from "@/types/domain";
import { NAME_MAX, WISHLIST_MAX, STUDENT_CODE_REGEX, cleanStudentCode } from "@/lib/validation";
import { GiftMark } from "../gift-mark";
import { SubmitButton } from "../submit-button";
import { Alert, ButtonLink, Card, Field, inputClasses } from "../ui";
import { PaperFields, type PaperState } from "./paper-fields";
import { PhotoPicker, type PickedPhoto } from "./photo-picker";
import { StudentCodeInput } from "./student-code-input";

const INITIAL: ActionState = { ok: false };

export function RegistrationForm() {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  // Las fotos (ya comprimidas) se envían junto con el resto del formulario.
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    for (const photo of photos) {
      formData.append("photos", photo.blob, "foto.jpg");
    }
    try {
      return await registerAction(previous, formData);
    } catch {
      return { ok: false, message: "No pudimos conectarnos. Revisa tu conexión e intenta de nuevo." };
    }
  }, INITIAL);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [wishlist, setWishlist] = useState("");
  const [paper, setPaper] = useState<PaperState>({ hasPaper: "", target: { name: "", id: "", unregistered: false } });

  if (state.ok && state.registered) {
    return (
      <Card className="text-center animate-pop">
        <GiftMark className="mx-auto h-20 w-20" />
        <h1 className="mt-4 font-display text-3xl font-semibold text-berry-800">¡Listo! Ya estás registrado.</h1>
        <p className="mt-3 text-muted">
          {state.registered.hasExistingAssignment
            ? "Guardamos tu papelito. La administradora lo validará cuando realice la asignación definitiva."
            : "Tu información fue registrada. La administradora realizará las asignaciones faltantes cuando todos estén registrados."}
        </p>
        {state.message ? <p className="mt-3 text-sm font-medium text-amber-700">{state.message}</p> : null}
        <ButtonLink href="/mi-cuenta" size="lg" className="mt-6 w-full">
          Ir a mi cuenta
        </ButtonLink>
      </Card>
    );
  }

  const errors = state.fieldErrors ?? {};
  const codeOk = STUDENT_CODE_REGEX.test(cleanStudentCode(code));
  const paperOk =
    paper.hasPaper === "no" || (paper.hasPaper === "yes" && paper.target.name.trim().length >= 2);
  const canSubmit = name.trim().length >= 2 && codeOk && paperOk;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Card className="space-y-5">
        <Field label="Nombre completo" htmlFor="name" error={errors.name}>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={NAME_MAX}
            placeholder="Ej. Brendy Caicedo"
            aria-invalid={errors.name ? true : undefined}
            className={inputClasses}
          />
        </Field>
        <StudentCodeInput name="studentCode" label="Código de estudiante" value={code} onChange={setCode} serverError={errors.studentCode} />
        <Field
          label="Lista de deseos"
          htmlFor="wishlist"
          error={errors.wishlist}
          hint="Opcional, pero ayuda mucho. Escribe una idea por línea."
        >
          <textarea
            id="wishlist"
            name="wishlist"
            rows={5}
            value={wishlist}
            onChange={(event) => setWishlist(event.target.value)}
            maxLength={WISHLIST_MAX}
            placeholder={"Chocolates\nCamiseta negra talla M\nUn libro"}
            className={`${inputClasses} resize-y leading-relaxed`}
          />
        </Field>
        <PhotoPicker photos={photos} onChange={setPhotos} error={errors.photos} />
      </Card>

      <Card>
        <PaperFields value={paper} onChange={setPaper} candidates={state.candidates} errors={errors} />
      </Card>

      {state.message && !state.ok ? <Alert tone="berry">{state.message}</Alert> : null}

      <SubmitButton size="lg" className="w-full" pendingText="Registrando…" disabled={!canSubmit}>
        Registrarme
      </SubmitButton>
    </form>
  );
}
