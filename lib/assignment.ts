/**
 * Algoritmo de asignación del amigo secreto (lógica pura, sin base de datos).
 *
 * Idea central:
 *   1. Los papelitos existentes (A → B) se CONSERVAN tal cual.
 *   2. "Dadores pendientes"   = quienes no tienen papelito.
 *      "Receptores libres"    = quienes nadie tiene en un papelito.
 *      Como cada papelito une un dador con un receptor distinto, ambos
 *      conjuntos siempre tienen el mismo tamaño.
 *   3. Hay que emparejar dadores pendientes con receptores libres sin que
 *      nadie se regale a sí mismo. Es un emparejamiento perfecto en un
 *      grafo bipartito completo al que le faltan las aristas x → x.
 *      Por el teorema de Hall siempre existe si hay 2 o más pendientes;
 *      con 1 solo pendiente es imposible cuando ese dador es también el
 *      único receptor libre (tendría que regalarse a sí mismo).
 *   4. Para elegir UNIFORMEMENTE entre todas las soluciones válidas se usa
 *      muestreo por rechazo (barajar y descartar si alguien queda consigo
 *      mismo). La probabilidad de éxito por intento es ≥ ~1/e, así que
 *      termina en pocos intentos. Como red de seguridad, si se agotan los
 *      intentos se usa backtracking con orden aleatorio, que encuentra una
 *      solución siempre que exista.
 *   5. Antes de todo se validan los papelitos: autoasignaciones, personas
 *      repetidas como destinatario y nombres sin vincular. Si hay un
 *      problema NO se inventa nada: se devuelve la lista de problemas.
 */

import type { AssignmentSource } from "@/types/database";

export type AssignmentParticipant = {
  id: string;
  name: string;
  hasExistingAssignment: boolean;
  /** Nombre tal como se escribió en el papelito. */
  reportedTargetName: string | null;
  /** Participante vinculado al papelito (null = referencia sin resolver). */
  reportedTargetId: string | null;
};

export type PlannedAssignment = {
  giverId: string;
  receiverId: string;
  source: AssignmentSource;
};

export type ProblemKind =
  | "NOT_ENOUGH_PARTICIPANTS"
  | "UNRESOLVED_REFERENCE"
  | "UNKNOWN_TARGET"
  | "SELF_ASSIGNMENT"
  | "DUPLICATE_RECEIVER"
  | "IMPOSSIBLE";

export type AssignmentProblem = {
  kind: ProblemKind;
  /** Mensaje en español para la administradora. */
  message: string;
  participantIds: string[];
};

export type AssignmentAnalysis = {
  existingCount: number;
  pendingGivers: string[];
  freeReceivers: string[];
  problems: AssignmentProblem[];
};

export type PlanResult =
  | { ok: true; assignments: PlannedAssignment[] }
  | { ok: false; problems: AssignmentProblem[] };

/** Devuelve un entero aleatorio en [0, max). */
export type RandomInt = (max: number) => number;

export const cryptoRandomInt: RandomInt = (max) => {
  if (max <= 0) {
    throw new Error("max debe ser positivo");
  }
  // Muestreo por rechazo para evitar sesgo de módulo.
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0];
    if (value < limit) {
      return value % max;
    }
  }
};

export const MIN_PARTICIPANTS = 2;
const REJECTION_ATTEMPTS = 500;

function shuffle<T>(items: readonly T[], randomInt: RandomInt): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) {
    return names.join("");
  }
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** Revisa los papelitos y calcula quién falta por dar y por recibir. */
export function analyzeAssignments(participants: readonly AssignmentParticipant[]): AssignmentAnalysis {
  const problems: AssignmentProblem[] = [];
  const byId = new Map<string, AssignmentParticipant>();
  for (const participant of participants) {
    byId.set(participant.id, participant);
  }

  if (participants.length < MIN_PARTICIPANTS) {
    problems.push({
      kind: "NOT_ENOUGH_PARTICIPANTS",
      message: `Se necesitan al menos ${MIN_PARTICIPANTS} participantes para hacer el sorteo.`,
      participantIds: [],
    });
  }

  const giversByReceiver = new Map<string, string[]>();
  let existingCount = 0;

  for (const participant of participants) {
    if (!participant.hasExistingAssignment) {
      continue;
    }
    existingCount++;
    const targetId = participant.reportedTargetId;
    const reported = participant.reportedTargetName ?? "(sin nombre)";

    if (targetId === null) {
      problems.push({
        kind: "UNRESOLVED_REFERENCE",
        message: `${participant.name} reportó «${reported}», pero ese nombre no está vinculado a ningún participante registrado. Vincúlalo en Participantes o espera a que esa persona se registre.`,
        participantIds: [participant.id],
      });
      continue;
    }
    if (targetId === participant.id) {
      problems.push({
        kind: "SELF_ASSIGNMENT",
        message: `${participant.name} reportó que se tiene a sí misma/o. Una persona no puede regalarse a sí misma.`,
        participantIds: [participant.id],
      });
      continue;
    }
    if (!byId.has(targetId)) {
      problems.push({
        kind: "UNKNOWN_TARGET",
        message: `${participant.name} reportó a una persona que ya no está registrada («${reported}»).`,
        participantIds: [participant.id],
      });
      continue;
    }
    const givers = giversByReceiver.get(targetId) ?? [];
    givers.push(participant.id);
    giversByReceiver.set(targetId, givers);
  }

  for (const [receiverId, givers] of giversByReceiver) {
    if (givers.length > 1) {
      const receiverName = byId.get(receiverId)?.name ?? "(desconocido)";
      const giverNames: string[] = [];
      for (const giverId of givers) {
        giverNames.push(byId.get(giverId)?.name ?? "(desconocido)");
      }
      problems.push({
        kind: "DUPLICATE_RECEIVER",
        message: `${receiverName} aparece en varios papelitos (${joinNames(giverNames)}). Una persona solo puede recibir un regalo: revisa cuál papelito es el correcto.`,
        participantIds: [receiverId, ...givers],
      });
    }
  }

  const pendingGivers: string[] = [];
  const freeReceivers: string[] = [];
  for (const participant of participants) {
    if (!participant.hasExistingAssignment) {
      pendingGivers.push(participant.id);
    }
    if (!giversByReceiver.has(participant.id)) {
      freeReceivers.push(participant.id);
    }
  }

  // Caso imposible: queda una sola persona sin destinatario y ella misma es
  // la única que nadie tiene.
  const blocking = problems.length > 0;
  if (!blocking && pendingGivers.length === 1 && freeReceivers.length === 1 && pendingGivers[0] === freeReceivers[0]) {
    const name = byId.get(pendingGivers[0])?.name ?? "(desconocido)";
    problems.push({
      kind: "IMPOSSIBLE",
      message: `${name} es la única persona sin papelito y también la única a quien nadie tiene. Tendría que regalarse a sí misma/o. Revisa si alguien perdió el papelito con ${name} o si algún papelito reportado es incorrecto.`,
      participantIds: [pendingGivers[0]],
    });
  }

  return { existingCount, pendingGivers, freeReceivers, problems };
}

/** Backtracking con orden aleatorio: encuentra una solución si existe. */
function backtrackMatch(givers: string[], receivers: string[], randomInt: RandomInt): Map<string, string> | null {
  const result = new Map<string, string>();
  const used = new Set<string>();

  const solve = (index: number): boolean => {
    if (index === givers.length) {
      return true;
    }
    const giver = givers[index];
    for (const receiver of shuffle(receivers, randomInt)) {
      if (receiver === giver || used.has(receiver)) {
        continue;
      }
      used.add(receiver);
      result.set(giver, receiver);
      if (solve(index + 1)) {
        return true;
      }
      used.delete(receiver);
      result.delete(giver);
    }
    return false;
  };

  return solve(0) ? result : null;
}

/** Empareja dadores con receptores sin autoasignaciones, al azar uniforme. */
export function matchPending(
  givers: readonly string[],
  receivers: readonly string[],
  randomInt: RandomInt = cryptoRandomInt,
): Map<string, string> | null {
  if (givers.length !== receivers.length) {
    return null;
  }
  if (givers.length === 0) {
    return new Map();
  }
  for (let attempt = 0; attempt < REJECTION_ATTEMPTS; attempt++) {
    const shuffled = shuffle(receivers, randomInt);
    let valid = true;
    for (let i = 0; i < givers.length; i++) {
      if (givers[i] === shuffled[i]) {
        valid = false;
        break;
      }
    }
    if (valid) {
      const result = new Map<string, string>();
      for (let i = 0; i < givers.length; i++) {
        result.set(givers[i], shuffled[i]);
      }
      return result;
    }
  }
  return backtrackMatch([...givers], [...receivers], randomInt);
}

/** Calcula el sorteo completo o devuelve los problemas que lo impiden. */
export function planAssignments(
  participants: readonly AssignmentParticipant[],
  randomInt: RandomInt = cryptoRandomInt,
): PlanResult {
  const analysis = analyzeAssignments(participants);
  if (analysis.problems.length > 0) {
    return { ok: false, problems: analysis.problems };
  }

  const matched = matchPending(analysis.pendingGivers, analysis.freeReceivers, randomInt);
  if (matched === null) {
    return {
      ok: false,
      problems: [
        {
          kind: "IMPOSSIBLE",
          message: "No existe una combinación válida con las asignaciones actuales. Revisa los papelitos reportados.",
          participantIds: [],
        },
      ],
    };
  }

  const assignments: PlannedAssignment[] = [];
  for (const participant of participants) {
    if (participant.hasExistingAssignment && participant.reportedTargetId !== null) {
      assignments.push({ giverId: participant.id, receiverId: participant.reportedTargetId, source: "EXISTING" });
      continue;
    }
    const receiverId = matched.get(participant.id);
    if (receiverId === undefined) {
      return {
        ok: false,
        problems: [{ kind: "IMPOSSIBLE", message: "Error interno: un participante quedó sin destinatario.", participantIds: [participant.id] }],
      };
    }
    assignments.push({ giverId: participant.id, receiverId, source: "GENERATED" });
  }

  const check = verifyAssignments(participants, assignments);
  if (check !== null) {
    return { ok: false, problems: [check] };
  }
  return { ok: true, assignments };
}

/**
 * Verificación final independiente: cada persona da exactamente una vez,
 * recibe exactamente una vez, nadie se tiene a sí misma y los papelitos
 * existentes se conservan. Devuelve null si todo está bien.
 */
export function verifyAssignments(
  participants: readonly AssignmentParticipant[],
  assignments: readonly PlannedAssignment[],
): AssignmentProblem | null {
  const fail = (message: string): AssignmentProblem => ({ kind: "IMPOSSIBLE", message, participantIds: [] });
  const ids = new Set<string>();
  for (const participant of participants) {
    ids.add(participant.id);
  }
  if (assignments.length !== participants.length) {
    return fail("El número de asignaciones no coincide con el número de participantes.");
  }
  const givers = new Set<string>();
  const receivers = new Set<string>();
  for (const assignment of assignments) {
    if (!ids.has(assignment.giverId) || !ids.has(assignment.receiverId)) {
      return fail("Hay una asignación con una persona que no está registrada.");
    }
    if (assignment.giverId === assignment.receiverId) {
      return fail("Una persona quedó asignada a sí misma.");
    }
    if (givers.has(assignment.giverId)) {
      return fail("Una persona quedó regalando dos veces.");
    }
    if (receivers.has(assignment.receiverId)) {
      return fail("Una persona quedó recibiendo dos regalos.");
    }
    givers.add(assignment.giverId);
    receivers.add(assignment.receiverId);
  }
  for (const participant of participants) {
    if (participant.hasExistingAssignment) {
      let preserved = false;
      for (const assignment of assignments) {
        if (
          assignment.giverId === participant.id &&
          assignment.receiverId === participant.reportedTargetId &&
          assignment.source === "EXISTING"
        ) {
          preserved = true;
          break;
        }
      }
      if (!preserved) {
        return fail("Un papelito existente no se conservó.");
      }
    }
  }
  return null;
}
