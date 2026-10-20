import type { PersonOption } from "@/types/domain";

/**
 * Normaliza un nombre para comparar: minúsculas, sin tildes,
 * sin signos y con espacios simples. "  Gabriela  LÓPEZ " → "gabriela lopez".
 */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-zñ0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(normalized: string): string[] {
  if (normalized.length === 0) {
    return [];
  }
  return normalized.split(" ");
}

/**
 * ¿El nombre reportado corresponde a este participante?
 * Coincide si TODAS las palabras escritas aparecen completas en el nombre.
 * "gabriela" ⊂ "gabriela lopez" ✔   "gabi" ⊄ "gabriela lopez" ✘
 */
export function reportedNameMatches(reportedNormalized: string, participantNormalized: string): boolean {
  const wanted = tokens(reportedNormalized);
  if (wanted.length === 0) {
    return false;
  }
  const available = tokens(participantNormalized);
  for (const word of wanted) {
    if (!available.includes(word)) {
      return false;
    }
  }
  return true;
}

/** Coincidencia parcial para el buscador mientras se escribe ("gab" → Gabriela). */
export function searchMatches(queryNormalized: string, participantNormalized: string): boolean {
  const wanted = tokens(queryNormalized);
  if (wanted.length === 0) {
    return false;
  }
  const available = tokens(participantNormalized);
  for (const word of wanted) {
    let found = false;
    for (const candidate of available) {
      if (candidate.startsWith(word)) {
        found = true;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
}

export type NamedParticipant = { id: string; name: string; name_normalized: string };

/** Participantes que podrían ser la persona escrita en un papelito. */
export function findCandidates(
  reportedName: string,
  participants: readonly NamedParticipant[],
  excludeId?: string,
): PersonOption[] {
  const reported = normalizeName(reportedName);
  const result: PersonOption[] = [];
  for (const participant of participants) {
    if (participant.id === excludeId) {
      continue;
    }
    if (reportedNameMatches(reported, participant.name_normalized)) {
      result.push({ id: participant.id, name: participant.name });
    }
  }
  return result;
}
