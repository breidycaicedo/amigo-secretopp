import "server-only";
import type { AssignmentSource, GameRow, GameSettingsRow, ParticipantRow } from "@/types/database";
import type { PersonOption } from "@/types/domain";
import { findCandidates, normalizeName, searchMatches, type NamedParticipant } from "./names";
import { db } from "./supabase";

/**
 * Acceso a datos del lado del servidor. Ninguna función de este archivo se
 * expone al navegador; las páginas deciden qué subconjunto mínimo mostrar.
 * Casi todo es POR JUEGO: cada consulta recibe el game_id.
 */

export class DataError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

function raise(error: { message: string; code?: string }): never {
  throw new DataError(error.message, error.code);
}

export async function listGames(): Promise<GameRow[]> {
  const { data, error } = await db().from("games").select("*").order("created_at", { ascending: true });
  if (error) {
    raise(error);
  }
  return data;
}

export async function getGameBySlug(slug: string): Promise<GameRow | null> {
  const { data, error } = await db().from("games").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    raise(error);
  }
  return data;
}

export async function getGameById(id: string): Promise<GameRow | null> {
  const { data, error } = await db().from("games").select("*").eq("id", id).maybeSingle();
  if (error) {
    raise(error);
  }
  return data;
}

/** Cuántos participantes tiene cada juego (para el listado de juegos). */
export async function countParticipantsByGame(): Promise<Map<string, number>> {
  const { data, error } = await db().from("participants").select("game_id");
  if (error) {
    raise(error);
  }
  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.game_id, (counts.get(row.game_id) ?? 0) + 1);
  }
  return counts;
}

export async function getSettings(gameId: string): Promise<GameSettingsRow> {
  const { data, error } = await db().from("game_settings").select("*").eq("game_id", gameId).single();
  if (error) {
    raise(error);
  }
  return data;
}

export async function getParticipantById(id: string): Promise<ParticipantRow | null> {
  const { data, error } = await db().from("participants").select("*").eq("id", id).maybeSingle();
  if (error) {
    raise(error);
  }
  return data;
}

/** Busca un código DENTRO de un juego: el mismo código puede existir en juegos distintos. */
export async function getParticipantByCode(gameId: string, code: string): Promise<ParticipantRow | null> {
  const { data, error } = await db()
    .from("participants")
    .select("*")
    .eq("game_id", gameId)
    .eq("student_code", code)
    .maybeSingle();
  if (error) {
    raise(error);
  }
  return data;
}

export async function listParticipants(gameId: string): Promise<ParticipantRow[]> {
  const { data, error } = await db()
    .from("participants")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });
  if (error) {
    raise(error);
  }
  return data;
}

async function listNamed(gameId: string): Promise<NamedParticipant[]> {
  const { data, error } = await db()
    .from("participants")
    .select("id, name, name_normalized")
    .eq("game_id", gameId);
  if (error) {
    raise(error);
  }
  return data;
}

/** Buscador de nombres para el formulario: solo id + nombre, máximo 6, dentro del juego. */
export async function searchPeople(gameId: string, query: string, excludeId?: string): Promise<PersonOption[]> {
  const normalized = normalizeName(query);
  if (normalized.length < 2) {
    return [];
  }
  const people = await listNamed(gameId);
  const result: PersonOption[] = [];
  for (const person of people) {
    if (person.id === excludeId) {
      continue;
    }
    if (searchMatches(normalized, person.name_normalized)) {
      result.push({ id: person.id, name: person.name });
    }
    if (result.length >= 6) {
      break;
    }
  }
  result.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return result;
}

export async function candidatesFor(gameId: string, reportedName: string, excludeId?: string): Promise<PersonOption[]> {
  return findCandidates(reportedName, await listNamed(gameId), excludeId);
}

/**
 * Cuando alguien se registra o cambia su nombre, intenta resolver los
 * papelitos del juego que lo mencionaban y aún no estaban vinculados. Solo
 * vincula si esa persona es la ÚNICA coincidencia; queda "sin confirmar".
 */
export async function resolvePendingReferences(gameId: string): Promise<void> {
  const { data: pending, error } = await db()
    .from("participants")
    .select("id, reported_target_name")
    .eq("game_id", gameId)
    .eq("has_existing_assignment", true)
    .is("reported_target_id", null);
  if (error) {
    raise(error);
  }
  if (pending.length === 0) {
    return;
  }
  const people = await listNamed(gameId);
  for (const row of pending) {
    if (row.reported_target_name === null) {
      continue;
    }
    const candidates = findCandidates(row.reported_target_name, people, row.id);
    if (candidates.length !== 1) {
      continue;
    }
    const update = await db()
      .from("participants")
      .update({ reported_target_id: candidates[0].id, reported_target_confirmed: false })
      .eq("id", row.id)
      .is("reported_target_id", null);
    if (update.error) {
      raise(update.error);
    }
  }
}

/** La persona a quien le regala el participante (solo su nombre y deseos). */
export async function getGiftFor(
  giverId: string,
): Promise<{ name: string; wishlist: string; wishlist_photos: string[] } | null> {
  const { data: assignment, error } = await db()
    .from("assignments")
    .select("receiver_id")
    .eq("giver_id", giverId)
    .maybeSingle();
  if (error) {
    raise(error);
  }
  if (assignment === null) {
    return null;
  }
  const { data: receiver, error: receiverError } = await db()
    .from("participants")
    .select("name, wishlist, wishlist_photos")
    .eq("id", assignment.receiver_id)
    .single();
  if (receiverError) {
    raise(receiverError);
  }
  return receiver;
}

export type AssignmentView = {
  id: string;
  giverName: string;
  receiverName: string;
  source: AssignmentSource;
};

export async function listAssignments(gameId: string): Promise<AssignmentView[]> {
  const [{ data: assignments, error }, people] = await Promise.all([
    db().from("assignments").select("*").eq("game_id", gameId).order("created_at", { ascending: true }),
    listNamed(gameId),
  ]);
  if (error) {
    raise(error);
  }
  const names = new Map<string, string>();
  for (const person of people) {
    names.set(person.id, person.name);
  }
  const views: AssignmentView[] = [];
  for (const assignment of assignments) {
    views.push({
      id: assignment.id,
      giverName: names.get(assignment.giver_id) ?? "(eliminado)",
      receiverName: names.get(assignment.receiver_id) ?? "(eliminado)",
      source: assignment.source,
    });
  }
  views.sort((a, b) => a.giverName.localeCompare(b.giverName, "es"));
  return views;
}
