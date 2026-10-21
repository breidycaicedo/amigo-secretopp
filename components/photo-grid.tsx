import type { ReactNode } from "react";

export type PhotoItem = { path: string; url: string };

/** Cuadrícula de fotos (solo lectura). Las URL son enlaces firmados temporales. */
export function PhotoGrid({ photos, renderAction }: { photos: PhotoItem[]; renderAction?: (photo: PhotoItem) => ReactNode }) {
  if (photos.length === 0) {
    return null;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {photos.map((photo, index) => (
        <li
          key={photo.path}
          className="relative aspect-square overflow-hidden rounded-2xl bg-cream ring-1 ring-line animate-rise"
          style={{ animationDelay: `${80 + index * 60}ms` }}
        >
          <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- enlace firmado temporal */}
            <img src={photo.url} alt={`Idea de regalo ${index + 1}`} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
          </a>
          {renderAction ? renderAction(photo) : null}
        </li>
      ))}
    </ul>
  );
}
