"use client";

import { useActionState, useState } from "react";
import { adminLoginAction } from "@/app/actions/auth";
import type { ActionState } from "@/types/domain";
import { SubmitButton } from "../submit-button";
import { Alert, Field, inputClasses } from "../ui";
import { StudentCodeInput } from "./student-code-input";

const INITIAL: ActionState = { ok: false };

export function AdminLoginForm({ requiresPassword }: { requiresPassword: boolean }) {
  const [state, formAction] = useActionState(adminLoginAction, INITIAL);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <StudentCodeInput
        name="adminCode"
        label="Código de administradora"
        value={code}
        onChange={setCode}
        serverError={state.fieldErrors?.adminCode}
        autoFocus
      />
      {requiresPassword ? (
        <Field label="Contraseña de administración" htmlFor="adminPassword">
          <input
            id="adminPassword"
            name="adminPassword"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClasses}
          />
        </Field>
      ) : null}
      {state.message ? <Alert tone="berry">{state.message}</Alert> : null}
      <SubmitButton size="lg" className="w-full" pendingText="Verificando…">
        Entrar a administración
      </SubmitButton>
    </form>
  );
}
