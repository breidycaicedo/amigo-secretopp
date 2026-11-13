"use client";

import { useState } from "react";
import { buttonClasses } from "../ui";

/** Muestra el enlace del juego y lo copia completo (con el dominio actual). */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el enlace queda visible para copiarlo a mano.
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="max-w-full break-all rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-line">{path}</code>
      <button type="button" onClick={copy} className={buttonClasses("secondary", "sm")}>
        {copied ? "¡Copiado!" : "Copiar enlace"}
      </button>
    </div>
  );
}
