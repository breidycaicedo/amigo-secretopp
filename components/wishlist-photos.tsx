"use client";

import { useState, useTransition } from "react";
import { deletePhotoAction, uploadPhotoAction } from "@/app/actions/photos";
import { MAX_PHOTOS } from "@/lib/image-type";
import type { ActionState } from "@/types/domain";
import { PhotoGrid, type PhotoItem } from "./photo-grid";
import { Spinner } from "./submit-button";
import { cx } from "./ui";

const MAX_SIDE = 1600;
const QUALITY = 0.82;

/**
 * Reduce la foto en el navegador antes de subirla (las fotos del celular
 * pesan 3–8 MB; así quedan en ~300 KB) y quita los metadatos (GPS, etc.).
 */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("canvas");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob"))), "image/jpeg", QUALITY);
  });
}

/** Fotos de la lista de deseos propia: subir y borrar. */
export function WishlistPhotos({ photos }: { photos: PhotoItem[] }) {
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);
  const full = photos.length >= MAX_PHOTOS;

  const onFile = (file: File | undefined) => {
    if (file === undefined) {
      return;
    }
    setState(null);
    startTransition(async () => {
      let blob: Blob;
      try {
        blob = await compress(file);
      } catch {
        setState({ ok: false, message: "No pudimos leer esa imagen. Prueba con una foto JPG o PNG (o una captura de pantalla)." });
        return;
      }
      const data = new FormData();
      data.append("photo", blob, "foto.jpg");
      try {
        setState(await uploadPhotoAction(data));
      } catch {
        setState({ ok: false, message: "No pudimos subir la foto. Revisa tu conexión e intenta de nuevo." });
      }
    });
  };

  const remove = (path: string) => {
    setDeleting(path);
    startTransition(async () => {
      const data = new FormData();
      data.append("path", path);
      try {
        setState(await deletePhotoAction(data));
      } catch {
        setState({ ok: false, message: "No pudimos borrar la foto. Intenta de nuevo." });
      }
      setDeleting(null);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Fotos de lo que te gustaría</p>
        <p className="text-xs text-muted">
          {photos.length} / {MAX_PHOTOS}
        </p>
      </div>

      <PhotoGrid
        photos={photos}
        renderAction={(photo) => (
          <button
            type="button"
            onClick={() => remove(photo.path)}
            disabled={pending}
            aria-label="Borrar foto"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-white backdrop-blur transition hover:bg-berry-700 disabled:opacity-50"
          >
            {deleting === photo.path ? <Spinner /> : "✕"}
          </button>
        )}
      />

      {!full ? (
        <label
          className={cx(
            "flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-berry-200 bg-berry-50/50 px-4 py-5 text-sm font-semibold text-berry-700 transition hover:border-berry-500 hover:bg-berry-50",
            pending && "pointer-events-none opacity-60",
          )}
        >
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {pending && deleting === null ? (
            <>
              <Spinner /> Subiendo foto…
            </>
          ) : (
            <>📷 Agregar foto</>
          )}
        </label>
      ) : null}

      {state?.message ? (
        <p role="status" className={cx("text-sm font-medium", state.ok ? "text-pine-700" : "text-berry-600")}>
          {state.message}
        </p>
      ) : (
        <p className="text-xs text-muted">
          Opcional. Sube capturas o fotos de lo que te gustaría recibir. Solo las verán quien te regale y la administradora.
        </p>
      )}
    </div>
  );
}
