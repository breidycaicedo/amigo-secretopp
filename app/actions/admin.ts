"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Json } from "@/types/database";
import type { ActionState } from "@/types/domain";
import { planAssignments, type AssignmentParticipant } from "@/lib/assignment";
import { isAdmin } from "@/lib/auth";
import {
  DataError,
  getGameById,
  getParticipantById,
  getSettings,
  listParticipants,
  resolvePendingReferences,
} from "@/lib/data";
import { ERRORS, messageForDbError } from "@/lib/errors";
import { field } from "@/lib/form";
import { canRunAssignment } from "@/lib/game-rules";
import { removePhotoFiles } from "@/lib/photos";
import { newGameSlug } from "@/lib/slug";
import { db } from "@/lib/supabase";

const uuid = z.string().uuid();
const gameName = z.string().trim().min(2, "Escribe un nombre de al menos 2 letras.").max(60, "El nombre es muy largo (máximo 60).");

/** Revalida todo el panel de administración (listas de juegos, panel de cada juego, cuenta). */
function refreshAdmin(): void {
  revalidatePath("/admin", "layout");
  revalidatePath("/mi-cuenta");
}

function failure(error: unknown): ActionState {
  if (error instanceof DataError) {
    return { ok: false, message: messageForDbError(error) };
  }
  return { ok: false, message: ERRORS.CONNECTION };
}

/** Juego indicado por el formulario: debe ser un UUID de un juego que exista. */
async function gameFromForm(formData: FormData): Promise<string | null> {
  const parsed = uuid.safeParse(field(formData, "gameId"));
  if (!parsed.success) {
    return null;
  }
  return (await getGameById(parsed.data)) === null ? null : parsed.data;
}

/** Crea un juego nuevo con su configuración y su enlace propio. */
export async function createGameAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) {
    return { ok: false, message: ERRORS.UNAUTHORIZED };
  }
  const parsed = gameName.safeParse(field(formData, "name"));
  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0].message } };
  }

  let slug = "";
  let created = false;
  try {
    // Si por casualidad el enlace ya existe, se prueba otro sufijo.
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      slug = newGameSlug(parsed.data);
      const { data: game, error } = await db()
        .from("games")
        .insert({ slug, name: parsed.data })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") {
          continue;
        }
        return { ok: false, message: messageForDbError(error) };
      }
      const settings = await db().from("game_settings").insert({ game_id: game.id });
      if (settings.error) {
        return { ok: false, message: messageForDbError(settings.error) };
      }
      created = true;
    }
  } catch (error) {
    return failure(error);
  }
  if (!created) {
    return { ok: false, message: ERRORS.DATABASE };
  }
  refreshAdmin();
  redirect(`/admin/juegos/${slug}`);
}

export async function setExpectedParticipantsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) {
    return { ok: false, message: ERRORS.UNAUTHORIZED };
  }
  const gameId = await gameFromForm(formData);
  if (gameId === null) {
    return { ok: false, message: ERRORS.GAME_NOT_FOUND };
  }
  const raw = field(formData, "expected").trim();
  let expected: number | null = null;
  if (raw.length > 0) {
    const parsed = z.coerce.number().int().min(2).max(1000).safeParse(raw);
    if (!parsed.success) {
      return { ok: false, fieldErrors: { expected: "Escribe un número entero entre 2 y 1000." } };
    }
    expected = parsed.data;
  }
  try {
    const { error } = await db().from("game_settings").update({ expected_participants: expected }).eq("game_id", gameId);
    if (error) {
      return { ok: false, message: messageForDbError(error) };
    }
  } catch (error) {
    return failure(error);
  }
  refreshAdmin();
  return { ok: true, message: "Cantidad esperada guardada." };
}

export async function setWishlistEditingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) {
    return { ok: false, message: ERRORS.UNAUTHORIZED };
  }
  const gameId = await gameFromForm(formData);
  if (gameId === null) {
    return { ok: false, message: ERRORS.GAME_NOT_FOUND };
  }
  const allow = field(formData, "allow") === "1";
  try {
    const { error } = await db()
      .from("game_settings")
      .update({ allow_wishlist_edit_after_lock: allow })
      .eq("game_id", gameId);
    if (error) {
      return { ok: false, message: messageForDbError(error) };
    }
  } catch (error) {
    return failure(error);
  }
  refreshAdmin();
  return {
    ok: true,
    message: allow
      ? "Los participantes podrán editar su lista de deseos después del sorteo."
      : "Las listas de deseos quedarán bloqueadas después del sorteo.",
  };
}

/**
 * Vincula (y confirma) la persona del papelito de un participante, o la desvincula.
 * El juego se toma del propio participante: no se puede vincular entre juegos.
 */
export async function linkReferenceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) {
    return { ok: false, message: ERRORS.UNAUTHORIZED };
  }
  const participantId = uuid.safeParse(field(formData, "participantId"));
  const rawTarget = field(formData, "targetId");
  if (!participantId.success) {
    return { ok: false, message: ERRORS.TARGET_NOT_FOUND };
  }
  try {
    const participant = await getParticipantById(participantId.data);
    if (participant === null || !participant.has_existing_assignment) {
      return { ok: false, message: "Esa persona no tiene un papelito reportado." };
    }
    const settings = await getSettings(participant.game_id);
    if (!canRunAssignment(settings.status)) {
      return { ok: false, message: ERRORS.GAME_LOCKED };
    }

    if (rawTarget.length === 0) {
      const { error } = await db()
        .from("participants")
        .update({ reported_target_id: null, reported_target_confirmed: false })
        .eq("id", participant.id);
      if (error) {
        return { ok: false, message: messageForDbError(error) };
      }
      refreshAdmin();
      return { ok: true, message: "Vínculo eliminado. El papelito quedó como referencia pendiente." };
    }

    const targetId = uuid.safeParse(rawTarget);
    if (!targetId.success) {
      return { ok: false, message: ERRORS.TARGET_NOT_FOUND };
    }
    if (targetId.data === participant.id) {
      return { ok: false, message: "Una persona no puede regalarse a sí misma." };
    }
    const target = await getParticipantById(targetId.data);
    if (target === null || target.game_id !== participant.game_id) {
      return { ok: false, message: ERRORS.TARGET_NOT_FOUND };
    }
    const { error } = await db()
      .from("participants")
      .update({ reported_target_id: target.id, reported_target_confirmed: true })
      .eq("id", participant.id);
    if (error) {
      return { ok: false, message: messageForDbError(error) };
    }
  } catch (error) {
    return failure(error);
  }
  refreshAdmin();
  return { ok: true, message: "Papelito vinculado y confirmado." };
}

export async function deleteParticipantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) {
    return { ok: false, message: ERRORS.UNAUTHORIZED };
  }
  const participantId = uuid.safeParse(field(formData, "participantId"));
  if (!participantId.success) {
    return { ok: false, message: ERRORS.PARTICIPANT_NOT_FOUND };
  }
  try {
    const existing = await getParticipantById(participantId.data);
    if (existing === null) {
      return { ok: false, message: ERRORS.PARTICIPANT_NOT_FOUND };
    }
    const settings = await getSettings(existing.game_id);
    if (!canRunAssignment(settings.status)) {
      return { ok: false, message: ERRORS.GAME_LOCKED };
    }
    const { error } = await db().from("participants").delete().eq("id", existing.id);
    if (error) {
      return { ok: false, message: messageForDbError(error) };
    }
    await removePhotoFiles(existing.wishlist_photos);
    await resolvePendingReferences(existing.game_id);
  } catch (error) {
    return failure(error);
  }
  refreshAdmin();
  return { ok: true, message: "Participante eliminado." };
}

function toAlgorithmInput(rows: Awaited<ReturnType<typeof listParticipants>>): AssignmentParticipant[] {
  const result: AssignmentParticipant[] = [];
  for (const row of rows) {
    result.push({
      id: row.id,
      name: row.name,
      hasExistingAssignment: row.has_existing_assignment,
      reportedTargetName: row.reported_target_name,
      reportedTargetId: row.reported_target_id,
    });
  }
  return result;
}

/**
 * "ASIGNAR TODOS" de UN juego: solo se ejecuta cuando la administradora lo pide.
 * Calcula el sorteo en el servidor y lo guarda de forma atómica con
 * commit_assignments; la base de datos vuelve a validar todo.
 */
export async function runAssignmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) {
    return { ok: false, message: ERRORS.UNAUTHORIZED };
  }
  if (field(formData, "confirm") !== "1") {
    return { ok: false, message: "Debes confirmar la acción." };
  }
  const gameId = await gameFromForm(formData);
  if (gameId === null) {
    return { ok: false, message: ERRORS.GAME_NOT_FOUND };
  }

  try {
    const settings = await getSettings(gameId);
    if (settings.status === "ASSIGNED") {
      return { ok: false, message: ERRORS.ALREADY_ASSIGNED };
    }
    if (!canRunAssignment(settings.status)) {
      return { ok: false, message: ERRORS.GAME_LOCKED };
    }

    const rows = await listParticipants(gameId);
    const missing = settings.expected_participants === null ? null : settings.expected_participants - rows.length;
    const needsExtraConfirmation = missing === null || missing > 0;
    if (needsExtraConfirmation && field(formData, "confirmMissing") !== "1") {
      return { ok: false, message: ERRORS.MISSING_CONFIRMATION };
    }

    const participants = toAlgorithmInput(rows);
    const plan = planAssignments(participants);
    if (!plan.ok) {
      const details: string[] = [];
      for (const problem of plan.problems) {
        details.push(problem.message);
      }
      return { ok: false, message: ERRORS.IMPOSSIBLE, details };
    }

    const payload: Json = plan.assignments.map((assignment) => ({
      giver_id: assignment.giverId,
      receiver_id: assignment.receiverId,
      source: assignment.source,
    }));
    const ids: string[] = [];
    for (const participant of participants) {
      ids.push(participant.id);
    }

    const { error } = await db().rpc("commit_assignments", {
      p_game_id: gameId,
      p_participant_ids: ids,
      p_assignments: payload,
    });
    if (error) {
      return { ok: false, message: messageForDbError(error) };
    }
  } catch (error) {
    return failure(error);
  }

  refreshAdmin();
  return { ok: true, message: "🎉 ¡Sorteo realizado! Las asignaciones quedaron bloqueadas." };
}
