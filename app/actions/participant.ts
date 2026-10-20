"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/types/domain";
import { currentParticipant } from "@/lib/auth";
import { DataError, getParticipantByCode, getSettings, resolvePendingReferences } from "@/lib/data";
import { ERRORS, messageForDbError } from "@/lib/errors";
import { field } from "@/lib/form";
import { canEditProfile, canEditWishlist, canRegister } from "@/lib/game-rules";
import { normalizeName } from "@/lib/names";
import { resolvePaper } from "@/lib/paper";
import { startSession } from "@/lib/session";
import { db } from "@/lib/supabase";
import { fieldErrorsFrom, nameSchema, paperSchema, studentCodeSchema, wishlistSchema } from "@/lib/validation";
import { z } from "zod";

const registrationSchema = z.object({
  name: nameSchema,
  studentCode: studentCodeSchema,
  wishlist: wishlistSchema,
});

function paperFields(formData: FormData) {
  return {
    hasPaper: field(formData, "hasPaper"),
    targetName: field(formData, "targetName"),
    targetId: field(formData, "targetId"),
    targetUnregistered: field(formData, "targetUnregistered"),
  };
}

function failure(error: unknown): ActionState {
  if (error instanceof DataError) {
    return { ok: false, message: messageForDbError(error) };
  }
  return { ok: false, message: ERRORS.CONNECTION };
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const basics = registrationSchema.safeParse({
    name: field(formData, "name"),
    studentCode: field(formData, "studentCode"),
    wishlist: field(formData, "wishlist"),
  });
  const paper = paperSchema.safeParse(paperFields(formData));

  if (!basics.success || !paper.success) {
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: {
        ...(basics.success ? {} : fieldErrorsFrom(basics.error)),
        ...(paper.success ? {} : fieldErrorsFrom(paper.error)),
      },
    };
  }

  try {
    const settings = await getSettings();
    if (!canRegister(settings.status)) {
      return { ok: false, message: "El registro está cerrado: la administradora ya realizó el sorteo." };
    }

    if ((await getParticipantByCode(basics.data.studentCode)) !== null) {
      return { ok: false, fieldErrors: { studentCode: ERRORS.CODE_TAKEN } };
    }

    const resolution = await resolvePaper(paper.data, { id: null, name: basics.data.name });
    if (!resolution.ok) {
      return {
        ok: false,
        fieldErrors: { targetName: resolution.error },
        candidates: "candidates" in resolution ? resolution.candidates : undefined,
      };
    }

    const { data: created, error } = await db()
      .from("participants")
      .insert({
        name: basics.data.name,
        name_normalized: normalizeName(basics.data.name),
        student_code: basics.data.studentCode,
        wishlist: basics.data.wishlist,
        ...resolution.fields,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        return { ok: false, fieldErrors: { studentCode: ERRORS.CODE_TAKEN } };
      }
      return { ok: false, message: messageForDbError(error) };
    }

    await resolvePendingReferences();
    await startSession({ role: "participant", participantId: created.id });
  } catch (error) {
    return failure(error);
  }

  revalidatePath("/admin", "layout");
  return {
    ok: true,
    registered: { name: basics.data.name, hasExistingAssignment: paper.data.hasExistingAssignment },
  };
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const participant = await currentParticipant();
    if (participant === null) {
      return { ok: false, message: ERRORS.SESSION_EXPIRED };
    }
    const settings = await getSettings();

    const wishlist = wishlistSchema.safeParse(field(formData, "wishlist"));
    if (!wishlist.success) {
      return { ok: false, fieldErrors: fieldErrorsFrom(wishlist.error) };
    }

    // Registro cerrado: solo la lista de deseos (si la administradora lo permite).
    if (!canEditProfile(settings.status)) {
      if (!canEditWishlist(settings.status, settings.allow_wishlist_edit_after_lock)) {
        return { ok: false, message: ERRORS.GAME_LOCKED };
      }
      const { error } = await db()
        .from("participants")
        .update({ wishlist: wishlist.data })
        .eq("id", participant.id);
      if (error) {
        return { ok: false, message: messageForDbError(error) };
      }
      revalidatePath("/mi-cuenta");
      return { ok: true, message: "Tu lista de deseos se actualizó." };
    }

    const name = nameSchema.safeParse(field(formData, "name"));
    const paper = paperSchema.safeParse(paperFields(formData));
    if (!name.success || !paper.success) {
      return {
        ok: false,
        message: "Revisa los campos marcados.",
        fieldErrors: {
          ...(name.success ? {} : fieldErrorsFrom(name.error)),
          ...(paper.success ? {} : fieldErrorsFrom(paper.error)),
        },
      };
    }

    // Si el papelito no cambió, se conserva el vínculo (y su confirmación).
    const unchanged =
      paper.data.hasExistingAssignment === participant.has_existing_assignment &&
      (!paper.data.hasExistingAssignment ||
        (paper.data.targetName === participant.reported_target_name &&
          (paper.data.targetId === null || paper.data.targetId === participant.reported_target_id)));

    let paperUpdate = {};
    if (!unchanged) {
      const resolution = await resolvePaper(paper.data, { id: participant.id, name: name.data });
      if (!resolution.ok) {
        return {
          ok: false,
          fieldErrors: { targetName: resolution.error },
          candidates: "candidates" in resolution ? resolution.candidates : undefined,
        };
      }
      paperUpdate = resolution.fields;
    }

    const { error } = await db()
      .from("participants")
      .update({
        name: name.data,
        name_normalized: normalizeName(name.data),
        wishlist: wishlist.data,
        ...paperUpdate,
      })
      .eq("id", participant.id);
    if (error) {
      return { ok: false, message: messageForDbError(error) };
    }
    await resolvePendingReferences();
  } catch (error) {
    return failure(error);
  }

  revalidatePath("/mi-cuenta");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Tus datos se guardaron." };
}
