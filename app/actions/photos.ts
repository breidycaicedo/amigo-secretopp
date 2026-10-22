"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/types/domain";
import { currentParticipant } from "@/lib/auth";
import { DataError, getSettings } from "@/lib/data";
import { ERRORS, messageForDbError } from "@/lib/errors";
import { field } from "@/lib/form";
import { canEditWishlist } from "@/lib/game-rules";
import { MAX_PHOTOS } from "@/lib/image-type";
import { readPhoto, removePhotoFiles, storePhotos } from "@/lib/photos";
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

    const photo = await readPhoto(formData.get("photo"));
    if (typeof photo === "string") {
      return { ok: false, message: photo };
    }
    const stored = await storePhotos(me.id, [photo]);
    if (stored.length === 0) {
      return { ok: false, message: "No pudimos subir la foto. Intenta de nuevo." };
    }
    const path = stored[0];

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
