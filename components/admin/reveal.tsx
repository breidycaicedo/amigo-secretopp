"use client";

import { useState, type ReactNode } from "react";
import { buttonClasses } from "../ui";

/**
 * La administradora también puede ser participante: las asignaciones se
 * muestran difuminadas hasta que ella decida verlas, para evitar spoilers.
 */
export function Reveal({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <div className={visible ? "" : "pointer-events-none select-none blur-md"} aria-hidden={!visible}>
        {children}
      </div>
      {!visible ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-3xl bg-paper/40 p-6 text-center">
          <p className="max-w-xs text-sm text-muted">Información privada. Si también participas, ¡cuidado con los spoilers!</p>
          <button type="button" onClick={() => setVisible(true)} className={buttonClasses("primary")}>
            Mostrar asignaciones
          </button>
        </div>
      ) : (
        <div className="mt-4 text-center">
          <button type="button" onClick={() => setVisible(false)} className={buttonClasses("ghost", "sm")}>
            Ocultar
          </button>
        </div>
      )}
    </div>
  );
}
