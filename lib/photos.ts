import "server-only";
import { randomUUID } from "node:crypto";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, detectImageType, type ImageType } from "./image-type";
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

export type ValidPhoto = { bytes: Uint8Array; type: ImageType };

/** Valida un archivo recibido: tamaño y formato REAL (por sus bytes). */
export async function readPhoto(entry: FormDataEntryValue | null): Promise<ValidPhoto | string> {
  if (!(entry instanceof File) || entry.size === 0) {
    return "Elige una foto.";
  }
  if (entry.size > MAX_PHOTO_BYTES) {
    return "La foto es muy pesada (máximo 3 MB).";
  }
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const type = detectImageType(bytes);
  if (type === null) {
    return "Ese archivo no es una imagen compatible. Usa JPG, PNG o WebP.";
  }
  return { bytes, type };
}

/** Lee todas las fotos de un formulario (campo "photos"). */
export async function readPhotos(formData: FormData): Promise<ValidPhoto[] | string> {
  const entries = formData.getAll("photos");
  if (entries.length > MAX_PHOTOS) {
    return `Puedes subir máximo ${MAX_PHOTOS} fotos.`;
  }
  const photos: ValidPhoto[] = [];
  for (const entry of entries) {
    const photo = await readPhoto(entry);
    if (typeof photo === "string") {
      return photo;
    }
    photos.push(photo);
  }
  return photos;
}

/**
 * Sube fotos a la carpeta del participante. La ruta la arma el servidor.
 * Devuelve las rutas que sí se subieron.
 */
export async function storePhotos(participantId: string, photos: readonly ValidPhoto[]): Promise<string[]> {
  const paths: string[] = [];
  for (const photo of photos) {
    const path = `${participantId}/${randomUUID()}.${photo.type.ext}`;
    if (await uploadPhotoFile(path, photo.bytes, photo.type.mime)) {
      paths.push(path);
    }
  }
  return paths;
}
