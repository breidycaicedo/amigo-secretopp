"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/types/domain";
import { currentParticipant } from "@/lib/auth";
import { DataError, getSettings } from "@/lib/data";
import { ERRORS, messageForDbError } from "@/lib/errors";
import { field } from "@/lib/form";
import { canEditWishlist } from "@/lib/game-rules";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, detectImageType } from "@/lib/image-type";
import { removePhotoFiles, uploadPhotoFile } from "@/lib/photos";
import { db } from "@/lib/supabase";

function refresh(): void {
  revalidatePath("/mi-cuenta");
  revalidatePath("/admin", "layout");
}

function failure(error: unknown): ActionState {
  if (error instanceof DataError) {
    return { ok: false, message: messageForDbError(error) };
  }
  return { ok: false, message: ERRORS.CONNECTION };
}

/** Sube una foto a la lista de deseos del participante de la sesión. */
export async function uploadPhotoAction(formData: FormData): Promise<ActionState> {
  try {
    const me = await currentParticipant();
    if (me === null) {
      return { ok: false, message: ERRORS.SESSION_EXPIRED };
    }
    const settings = await getSettings();
    if (!canEditWishlist(settings.status, settings.allow_wishlist_edit_after_lock)) {
      return { ok: false, message: ERRORS.GAME_LOCKED };
    }
    if (me.wishlist_photos.length >= MAX_PHOTOS) {
      return { ok: false, message: `Puedes subir máximo ${MAX_PHOTOS} fotos. Borra una para agregar otra.` };
    }

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Elige una foto." };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return { ok: false, message: "La foto es muy pesada (máximo 3 MB)." };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (type === null) {
      return { ok: false, message: "Ese archivo no es una imagen compatible. Usa JPG, PNG o WebP." };
    }

    // La ruta la arma el servidor: siempre dentro de la carpeta del participante.
    const path = `${me.id}/${randomUUID()}.${type.ext}`;
    if (!(await uploadPhotoFile(path, bytes, type.mime))) {
      return { ok: false, message: "No pudimos subir la foto. Intenta de nuevo." };
    }

    const { error } = await db()
      .from("participants")
      .update({ wishlist_photos: [...me.wishlist_photos, path] })
      .eq("id", me.id);
    if (error) {
      await removePhotoFiles([path]);
      return { ok: false, message: messageForDbError(error) };
    }
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, message: "Foto agregada." };
}

/** Borra una foto propia. Solo acepta rutas que ya estén en su lista. */
export async function deletePhotoAction(formData: FormData): Promise<ActionState> {
  const path = field(formData, "path");
  try {
    const me = await currentParticipant();
    if (me === null) {
      return { ok: false, message: ERRORS.SESSION_EXPIRED };
    }
    const settings = await getSettings();
    if (!canEditWishlist(settings.status, settings.allow_wishlist_edit_after_lock)) {
      return { ok: false, message: ERRORS.GAME_LOCKED };
    }
    if (!me.wishlist_photos.includes(path)) {
      return { ok: false, message: "Esa foto no existe." };
    }
    const remaining: string[] = [];
    for (const item of me.wishlist_photos) {
      if (item !== path) {
        remaining.push(item);
      }
    }
    const { error } = await db().from("participants").update({ wishlist_photos: remaining }).eq("id", me.id);
    if (error) {
      return { ok: false, message: messageForDbError(error) };
    }
    await removePhotoFiles([path]);
  } catch (error) {
    return failure(error);
  }
  refresh();
  return { ok: true, message: "Foto eliminada." };
}
