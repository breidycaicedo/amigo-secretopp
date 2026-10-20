import type { GameStatus } from "@/types/database";

/** Reglas de negocio según el estado del juego (funciones puras). */

export function canRegister(status: GameStatus): boolean {
  return status === "REGISTRATION_OPEN";
}

/** Nombre y papelito solo se editan con el registro abierto. */
export function canEditProfile(status: GameStatus): boolean {
  return status === "REGISTRATION_OPEN";
}

/** La lista de deseos: abierta siempre en registro; tras el sorteo solo si la administradora lo permite. */
export function canEditWishlist(status: GameStatus, allowAfterLock: boolean): boolean {
  if (status === "REGISTRATION_OPEN") {
    return true;
  }
  if (status === "ASSIGNED") {
    return allowAfterLock;
  }
  return false;
}

export function canRunAssignment(status: GameStatus): boolean {
  return status === "REGISTRATION_OPEN";
}

export function canSeeResult(status: GameStatus): boolean {
  return status === "ASSIGNED";
}

export const STATUS_LABELS: Record<GameStatus, string> = {
  REGISTRATION_OPEN: "Registro abierto",
  ASSIGNING: "Asignando…",
  ASSIGNED: "Sorteo realizado",
};
