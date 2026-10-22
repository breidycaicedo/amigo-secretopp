"use client";

import { useEffect, useState } from "react";
import { UNREADABLE_IMAGE, compressImage } from "@/lib/compress-image";
import { MAX_PHOTOS } from "@/lib/image-type";
import { Spinner } from "../submit-button";
import { cx } from "../ui";

export type PickedPhoto = { id: string; blob: Blob; preview: string };

/**
 * Selector de fotos del formulario de registro: comprime y muestra vista
 * previa en el navegador; las fotos se envían junto con el registro.
 */
export function PhotoPicker({
  photos,
  onChange,
  error,
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  error?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      for (const photo of photos) {
        URL.revokeObjectURL(photo.preview);
      }
    };
    // Solo al desmontar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async (files: FileList | null) => {
    if (files === null || files.length === 0) {
      return;
    }
    setLocalError(null);
    setBusy(true);
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) {
        setLocalError(`Puedes subir máximo ${MAX_PHOTOS} fotos.`);
        break;
      }
      try {
        const blob = await compressImage(file);
        next.push({ id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) });
      } catch {
        setLocalError(UNREADABLE_IMAGE);
      }
    }
    onChange(next);
    setBusy(false);
  };

  const remove = (id: string) => {
    const next: PickedPhoto[] = [];
    for (const photo of photos) {
      if (photo.id === id) {
        URL.revokeObjectURL(photo.preview);
      } else {
        next.push(photo);
      }
    }
    onChange(next);
  };

  const message = localError ?? error;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Fotos de lo que te gustaría</p>
        <p className="text-xs text-muted">
          {photos.length} / {MAX_PHOTOS}
        </p>
      </div>

      {photos.length > 0 ? (
        <ul className="grid grid-cols-4 gap-2">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative aspect-square overflow-hidden rounded-xl bg-cream ring-1 ring-line animate-pop">
              {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local */}
              <img src={photo.preview} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(photo.id)}
                aria-label="Quitar foto"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-xs text-white backdrop-blur hover:bg-berry-700"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {photos.length < MAX_PHOTOS ? (
        <label
          className={cx(
            "flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-berry-200 bg-berry-50/50 px-4 py-4 text-sm font-semibold text-berry-700 transition hover:border-berry-500 hover:bg-berry-50",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              void add(event.target.files);
              event.target.value = "";
            }}
          />
          {busy ? (
            <>
              <Spinner /> Preparando fotos…
            </>
          ) : (
            <>📷 Agregar fotos</>
          )}
        </label>
      ) : null}

      {message ? (
        <p className="text-sm font-medium text-berry-600">{message}</p>
      ) : (
        <p className="text-xs text-muted">Opcional. Capturas o fotos de lo que te gustaría recibir; solo las verá quien te regale.</p>
      )}
    </div>
  );
}
