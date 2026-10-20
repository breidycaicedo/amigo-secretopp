import "server-only";
import type { PersonOption } from "@/types/domain";
import { ERRORS } from "./errors";
import { candidatesFor, getParticipantById } from "./data";
import { normalizeName } from "./names";
import type { PaperInput } from "./validation";

export type PaperFields = {
  has_existing_assignment: boolean;
  reported_target_name: string | null;
  reported_target_id: string | null;
  reported_target_confirmed: boolean;
};

export type PaperResolution =
  | { ok: true; fields: PaperFields }
  | { ok: false; error: string }
  | { ok: false; candidates: PersonOption[]; error: string };

const NO_PAPER: PaperFields = {
  has_existing_assignment: false,
  reported_target_name: null,
  reported_target_id: null,
  reported_target_confirmed: false,
};

/**
 * Convierte lo que la persona escribió sobre su papelito en datos guardables.
 * Nunca confía solo en el texto libre: intenta vincular con un participante
 * real; si hay varias coincidencias, pide elegir; si no hay ninguna, lo deja
 * como referencia pendiente (no se pierde el papelito).
 */
export async function resolvePaper(
  paper: PaperInput,
  self: { id: string | null; name: string },
): Promise<PaperResolution> {
  if (!paper.hasExistingAssignment) {
    return { ok: true, fields: NO_PAPER };
  }

  if (normalizeName(paper.targetName) === normalizeName(self.name)) {
    return { ok: false, error: ERRORS.SELF_TARGET };
  }

  if (paper.targetId !== null) {
    if (paper.targetId === self.id) {
      return { ok: false, error: ERRORS.SELF_TARGET };
    }
    const target = await getParticipantById(paper.targetId);
    if (target === null) {
      return { ok: false, error: ERRORS.TARGET_NOT_FOUND };
    }
    return {
      ok: true,
      fields: {
        has_existing_assignment: true,
        reported_target_name: target.name,
        reported_target_id: target.id,
        reported_target_confirmed: true,
      },
    };
  }

  const pending: PaperFields = {
    has_existing_assignment: true,
    reported_target_name: paper.targetName,
    reported_target_id: null,
    reported_target_confirmed: false,
  };

  if (paper.targetUnregistered) {
    return { ok: true, fields: pending };
  }

  const candidates = await candidatesFor(paper.targetName, self.id ?? undefined);
  if (candidates.length === 0) {
    return { ok: true, fields: pending };
  }
  if (candidates.length === 1) {
    return {
      ok: true,
      fields: { ...pending, reported_target_id: candidates[0].id, reported_target_confirmed: false },
    };
  }
  return {
    ok: false,
    candidates,
    error: `Hay varias personas que coinciden con «${paper.targetName}». Elige cuál es.`,
  };
}
