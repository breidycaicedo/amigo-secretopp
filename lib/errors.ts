/** Mensajes de error en español, centralizados. */
export const ERRORS = {
  INVALID_CODE: "El código debe tener el formato A00 seguido de 6 dígitos (ej. A00123456).",
  CODE_TAKEN: "Ese código de estudiante ya está registrado. Si eres tú, entra con «Ya estoy registrado».",
  PARTICIPANT_NOT_FOUND: "No encontramos a ningún participante con ese código. ¿Ya te registraste?",
  SESSION_EXPIRED: "Tu sesión expiró. Vuelve a entrar con tu código.",
  UNAUTHORIZED: "No tienes permiso para realizar esta acción.",
  ADMIN_INVALID: "Los datos de administración no son correctos.",
  DATABASE: "Hubo un problema con la base de datos. Intenta de nuevo en unos segundos.",
  CONNECTION: "No pudimos conectarnos. Revisa tu conexión a internet e intenta de nuevo.",
  IMPOSSIBLE: "⚠️ No existe una combinación válida con las asignaciones actuales.",
  ALREADY_ASSIGNED: "El sorteo ya se realizó. Las asignaciones están bloqueadas y no se puede volver a sortear.",
  GAME_LOCKED: "El juego ya está bloqueado. Ya no se pueden hacer cambios.",
  TARGET_NOT_FOUND: "Persona no encontrada. Elige un nombre de la lista o escríbelo tal como aparece en tu papelito.",
  SELF_TARGET: "No puedes reportarte a ti misma/o como la persona que te salió.",
  TOO_MANY_ATTEMPTS: "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.",
  PARTICIPANTS_CHANGED: "La lista de participantes cambió mientras se hacía el sorteo. No se guardó nada; revisa e intenta de nuevo.",
  MISSING_CONFIRMATION: "Todavía faltan participantes por registrarse. Marca la confirmación adicional para continuar.",
  NOT_ENOUGH: "Se necesitan al menos 2 participantes para hacer el sorteo.",
} as const;

type DbError = { code?: string; message?: string } | null | undefined;

/** Traduce errores de PostgreSQL / de los triggers a mensajes para la persona. */
export function messageForDbError(error: DbError): string {
  if (error === null || error === undefined) {
    return ERRORS.DATABASE;
  }
  const message = error.message ?? "";
  if (message.includes("ALREADY_ASSIGNED")) {
    return ERRORS.ALREADY_ASSIGNED;
  }
  if (message.includes("GAME_LOCKED") || message.includes("ASSIGNMENTS_LOCKED")) {
    return ERRORS.GAME_LOCKED;
  }
  if (message.includes("PARTICIPANTS_CHANGED")) {
    return ERRORS.PARTICIPANTS_CHANGED;
  }
  if (message.includes("NOT_ENOUGH_PARTICIPANTS")) {
    return ERRORS.NOT_ENOUGH;
  }
  if (
    message.includes("EXISTING_NOT_PRESERVED") ||
    message.includes("INCOMPLETE_ASSIGNMENT") ||
    message.includes("INVALID_SOURCE")
  ) {
    return `${ERRORS.IMPOSSIBLE} La base de datos rechazó el resultado; no se guardó nada.`;
  }
  if (error.code === "23505") {
    if (message.includes("student_code")) {
      return ERRORS.CODE_TAKEN;
    }
    return `${ERRORS.IMPOSSIBLE} Se detectó una persona repetida; no se guardó nada.`;
  }
  if (message.toLowerCase().includes("fetch failed") || message.toLowerCase().includes("network")) {
    return ERRORS.CONNECTION;
  }
  return ERRORS.DATABASE;
}
