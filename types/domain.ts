import type { AssignmentSource, GameStatus } from "./database";

export type { AssignmentSource, GameStatus };

/** Estado devuelto por las Server Actions a los formularios. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** Opciones cuando el nombre escrito coincide con varias personas. */
  candidates?: PersonOption[];
  /** Pantalla de éxito después del registro. */
  registered?: { name: string; hasExistingAssignment: boolean };
  /** Lista de problemas detallados (p. ej. por qué el sorteo es imposible). */
  details?: string[];
};

export type PersonOption = { id: string; name: string };

export type Session =
  | { role: "participant"; participantId: string }
  | { role: "admin" };

/** Estado de cada participante en la tabla de administración. */
export type ParticipantReviewStatus =
  | "OK"
  | "PENDING"
  | "UNRESOLVED_REFERENCE"
  | "NEEDS_REVIEW"
  | "CONFLICT";
