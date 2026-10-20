"use client";

import type { PersonOption } from "@/types/domain";
import { cx } from "../ui";
import { TargetPicker, type TargetValue } from "./target-picker";

export type PaperState = { hasPaper: "" | "yes" | "no"; target: TargetValue };

/** Pregunta del papelito + selector de persona. */
export function PaperFields({
  value,
  onChange,
  candidates,
  errors,
}: {
  value: PaperState;
  onChange: (value: PaperState) => void;
  candidates?: PersonOption[];
  errors?: Partial<Record<string, string>>;
}) {
  const option = (key: "yes" | "no", title: string, detail: string) => {
    const selected = value.hasPaper === key;
    return (
      <label
        className={cx(
          "flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-1 transition",
          selected ? "bg-berry-50 ring-2 ring-berry-500" : "bg-white ring-line hover:ring-berry-200",
        )}
      >
        <input
          type="radio"
          name="hasPaper"
          value={key}
          checked={selected}
          onChange={() => onChange({ ...value, hasPaper: key })}
          className="mt-1 accent-berry-600"
        />
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="block text-sm text-muted">{detail}</span>
        </span>
      </label>
    );
  };

  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 block text-sm font-semibold text-ink">¿Tienes una persona asignada en tu papelito?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {option("yes", "Sí, tengo una persona asignada", "Conservaremos tu papelito.")}
        {option("no", "No, no tengo una persona asignada", "Te asignaremos a alguien al final.")}
      </div>
      {errors?.hasPaper ? <p className="text-sm font-medium text-berry-600">{errors.hasPaper}</p> : null}

      {value.hasPaper === "yes" ? (
        <div className="pt-2 animate-rise">
          <TargetPicker
            value={value.target}
            onChange={(target) => onChange({ ...value, target })}
            candidates={candidates}
            error={errors?.targetName}
          />
        </div>
      ) : null}

      {value.hasPaper === "no" ? (
        <p className="rounded-2xl bg-cream px-4 py-3 text-sm text-muted ring-1 ring-line animate-rise">
          Quedarás como <strong className="text-ink">pendiente</strong>. La administradora realizará las asignaciones
          faltantes cuando todos estén registrados.
        </p>
      ) : null}
    </fieldset>
  );
}
