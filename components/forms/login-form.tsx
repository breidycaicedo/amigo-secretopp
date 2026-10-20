"use client";

import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import type { ActionState } from "@/types/domain";
import { SubmitButton } from "../submit-button";
import { Alert } from "../ui";
import { StudentCodeInput } from "./student-code-input";

const INITIAL: ActionState = { ok: false };

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, INITIAL);
  const [code, setCode] = useState("");
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <StudentCodeInput
        name="studentCode"
        label="Código de estudiante"
        value={code}
        onChange={setCode}
        serverError={state.fieldErrors?.studentCode}
        autoFocus
      />
      {state.message ? <Alert tone="berry">{state.message}</Alert> : null}
      <SubmitButton size="lg" className="w-full" pendingText="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
