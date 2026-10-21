import "server-only";
import { db } from "./supabase";

/**
 * Fotos de la lista de deseos en el bucket PRIVADO "wishlist".
 * El navegador nunca recibe rutas permanentes: solo enlaces firmados
 * que expiran, generados para quien tiene permiso de verlos.
 */
export const PHOTO_BUCKET = "wishlist";
const SIGNED_URL_SECONDS = 60 * 60;

export type SignedPhoto = { path: string; url: string };

/** Firma varias rutas en una sola llamada. Las que fallen se omiten. */
export async function signPhotos(paths: readonly string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) {
    return result;
  }
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUrls([...paths], SIGNED_URL_SECONDS);
  if (error || data === null) {
    return result;
  }
  for (const item of data) {
    if (item.path !== null && item.signedUrl) {
      result.set(item.path, item.signedUrl);
    }
  }
  return result;
}

/** Devuelve las fotos firmadas en el mismo orden que las rutas. */
export async function signedPhotosFor(paths: readonly string[]): Promise<SignedPhoto[]> {
  const urls = await signPhotos(paths);
  const photos: SignedPhoto[] = [];
  for (const path of paths) {
    const url = urls.get(path);
    if (url !== undefined) {
      photos.push({ path, url });
    }
  }
  return photos;
}

/** Borra archivos del bucket (si falla, no interrumpe la acción principal). */
export async function removePhotoFiles(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  await db().storage.from(PHOTO_BUCKET).remove([...paths]);
}

export async function uploadPhotoFile(path: string, bytes: Uint8Array, contentType: string): Promise<boolean> {
  const { error } = await db()
    .storage.from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType, upsert: false, cacheControl: "3600" });
  return error === null;
}
