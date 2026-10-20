"use client";

import { useState } from "react";
import { STUDENT_CODE_REGEX, cleanStudentCode } from "@/lib/validation";
import { ERRORS } from "@/lib/errors";
import { Field, inputClasses } from "../ui";

/** Campo de código con validación inmediata (el servidor vuelve a validar). */
export function StudentCodeInput({
  name,
  label,
  value,
  onChange,
  serverError,
  autoFocus,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  serverError?: string;
  autoFocus?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const cleaned = cleanStudentCode(value);
  const localError = touched && cleaned.length > 0 && !STUDENT_CODE_REGEX.test(cleaned) ? ERRORS.INVALID_CODE : undefined;
  const error = localError ?? serverError;
  const valid = STUDENT_CODE_REGEX.test(cleaned);

  return (
    <Field label={label} htmlFor={name} error={error} hint="Formato: A00 seguido de 6 dígitos (ej. A00123456).">
      <div className="relative">
        <input
          id={name}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          onBlur={() => setTouched(true)}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          placeholder="A00123456"
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className={`${inputClasses} font-mono tracking-[0.15em]`}
        />
        {valid ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-pine-600" aria-hidden="true">
            ✓
          </span>
        ) : null}
      </div>
    </Field>
  );
}
