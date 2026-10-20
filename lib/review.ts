import type { ParticipantRow } from "@/types/database";
import type { ParticipantReviewStatus, PersonOption } from "@/types/domain";
import { analyzeAssignments, type AssignmentParticipant } from "./assignment";
import { findCandidates } from "./names";

/**
 * Resumen para el panel de administración (lógica pura, probada en tests).
 */

export type ParticipantReview = {
  id: string;
  name: string;
  studentCode: string;
  wishlist: string;
  hasPaper: boolean;
  reportedName: string | null;
  linkedName: string | null;
  linkedId: string | null;
  confirmed: boolean;
  status: ParticipantReviewStatus;
  /** Sugerencias para vincular cuando el papelito no está confirmado. */
  suggestions: PersonOption[];
};

export type AdminSummary = {
  registered: number;
  expected: number | null;
  missing: number | null;
  existing: number;
  toResolve: number;
  unresolvedReferences: number;
  unconfirmedLinks: number;
  problems: string[];
  reviews: ParticipantReview[];
};

export function toAssignmentParticipants(rows: readonly ParticipantRow[]): AssignmentParticipant[] {
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

export function buildAdminSummary(rows: readonly ParticipantRow[], expected: number | null): AdminSummary {
  const names = new Map<string, string>();
  const reportersByTarget = new Map<string, number>();
  for (const row of rows) {
    names.set(row.id, row.name);
    if (row.has_existing_assignment && row.reported_target_id !== null) {
      reportersByTarget.set(row.reported_target_id, (reportersByTarget.get(row.reported_target_id) ?? 0) + 1);
    }
  }

  const analysis = analyzeAssignments(toAssignmentParticipants(rows));
  const problems: string[] = [];
  for (const problem of analysis.problems) {
    // Con menos de 2 personas no es un "problema de papelitos": se muestra aparte.
    if (problem.kind !== "NOT_ENOUGH_PARTICIPANTS") {
      problems.push(problem.message);
    }
  }

  let unresolved = 0;
  let unconfirmed = 0;
  const reviews: ParticipantReview[] = [];
  for (const row of rows) {
    let status: ParticipantReviewStatus = "PENDING";
    let suggestions: PersonOption[] = [];
    if (row.has_existing_assignment) {
      if (row.reported_target_id === null) {
        status = "UNRESOLVED_REFERENCE";
        unresolved++;
      } else if ((reportersByTarget.get(row.reported_target_id) ?? 0) > 1) {
        status = "CONFLICT";
      } else if (!row.reported_target_confirmed) {
        status = "NEEDS_REVIEW";
        unconfirmed++;
      } else {
        status = "OK";
      }
      if (status !== "OK" && row.reported_target_name !== null) {
        suggestions = findCandidates(row.reported_target_name, rows, row.id);
      }
    }
    reviews.push({
      id: row.id,
      name: row.name,
      studentCode: row.student_code,
      wishlist: row.wishlist,
      hasPaper: row.has_existing_assignment,
      reportedName: row.reported_target_name,
      linkedName: row.reported_target_id === null ? null : (names.get(row.reported_target_id) ?? null),
      linkedId: row.reported_target_id,
      confirmed: row.reported_target_confirmed,
      status,
      suggestions,
    });
  }

  return {
    registered: rows.length,
    expected,
    missing: expected === null ? null : expected - rows.length,
    existing: analysis.existingCount,
    toResolve: analysis.pendingGivers.length,
    unresolvedReferences: unresolved,
    unconfirmedLinks: unconfirmed,
    problems,
    reviews,
  };
}

export const REVIEW_LABELS: Record<ParticipantReviewStatus, string> = {
  OK: "OK",
  PENDING: "Pendiente",
  UNRESOLVED_REFERENCE: "Sin vincular",
  NEEDS_REVIEW: "Verificar",
  CONFLICT: "Conflicto",
};
