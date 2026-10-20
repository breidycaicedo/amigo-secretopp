"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PersonOption } from "@/types/domain";
import { cx, inputClasses } from "../ui";

export type TargetValue = { name: string; id: string; unregistered: boolean };

/**
 * Campo "¿Quién te salió?": busca entre los participantes registrados
 * mientras se escribe. Si la persona no aparece, el nombre se guarda
 * como referencia pendiente. Solo recibe nombres (nunca códigos ni datos).
 */
export function TargetPicker({
  value,
  onChange,
  candidates,
  error,
}: {
  value: TargetValue;
  onChange: (value: TargetValue) => void;
  candidates?: PersonOption[];
  error?: string;
}) {
  const inputId = useId();
  const [suggestions, setSuggestions] = useState<PersonOption[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const query = value.name.trim();
    if (value.id !== "" || query.length < 2) {
      return;
    }
    const requestNumber = ++requestRef.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/personas?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data: { people: PersonOption[] } = await response.json();
        if (requestNumber === requestRef.current) {
          setSuggestions(data.people);
        }
      } catch {
        // Sin conexión: el nombre igual se puede guardar como referencia.
      } finally {
        if (requestNumber === requestRef.current) {
          setSearching(false);
        }
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [value.name, value.id]);

  const choose = (person: PersonOption) => {
    onChange({ name: person.name, id: person.id, unregistered: false });
    setOpen(false);
  };

  const showSuggestions = open && value.id === "" && value.name.trim().length >= 2;
  const ambiguous = candidates !== undefined && candidates.length > 1 && value.id === "" && !value.unregistered;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-ink">
        Escribe el nombre de la persona que te salió
      </label>
      <div className="relative">
        <input
          id={inputId}
          name="targetName"
          autoComplete="off"
          value={value.name}
          onChange={(event) => {
            onChange({ name: event.target.value, id: "", unregistered: false });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Ej. Gabriela López"
          aria-invalid={error ? true : undefined}
          aria-autocomplete="list"
          className={cx(inputClasses, value.id !== "" && "pr-28 ring-pine-600/40")}
        />
        {value.id !== "" ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-pine-700">
            ✓ Registrada
          </span>
        ) : null}
        {showSuggestions ? (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-line animate-fade">
            {suggestions.length > 0 ? (
              <ul role="listbox">
                {suggestions.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(person)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] hover:bg-berry-50 focus:bg-berry-50 focus:outline-none"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-100 text-sm font-bold text-gold-700">
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                      {person.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-muted">
                {searching ? "Buscando…" : "Aún no hay nadie registrado con ese nombre. Se guardará como referencia pendiente."}
              </p>
            )}
          </div>
        ) : null}
      </div>

      <input type="hidden" name="targetId" value={value.id} />
      <input type="hidden" name="targetUnregistered" value={value.unregistered ? "1" : ""} />

      {error && !ambiguous ? <p className="text-sm font-medium text-berry-600">{error}</p> : null}

      {ambiguous ? (
        <fieldset className="space-y-2 rounded-2xl bg-gold-100/60 p-4 ring-1 ring-gold-300/50 animate-rise">
          <legend className="sr-only">Elige la persona correcta</legend>
          <p className="text-sm font-semibold text-ink">¿Quién es «{value.name}»?</p>
          {candidates.map((person) => (
            <label key={person.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-line hover:ring-berry-200">
              <input type="radio" name="candidatePick" className="accent-berry-600" onChange={() => choose(person)} />
              <span>{person.name}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted">
            <input
              type="radio"
              name="candidatePick"
              className="accent-berry-600"
              onChange={() => onChange({ name: value.name, id: "", unregistered: true })}
            />
            Ninguna: esa persona todavía no se ha registrado
          </label>
        </fieldset>
      ) : null}

      {value.id === "" && value.unregistered ? (
        <p className="text-xs text-muted">Se guardará como referencia pendiente hasta que esa persona se registre.</p>
      ) : null}
    </div>
  );
}
