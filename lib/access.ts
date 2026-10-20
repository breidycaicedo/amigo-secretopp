import type { Session } from "@/types/domain";

/**
 * Decide qué hacer con una petición según la ruta y la sesión.
 * Función pura: la usa proxy.ts y se prueba en tests/access.test.ts.
 * Las páginas vuelven a verificar la sesión (defensa en profundidad).
 */
export type AccessDecision =
  | { type: "allow" }
  | { type: "redirect"; to: string }
  | { type: "forbidden" };

function isAdminArea(pathname: string): boolean {
  return pathname === "/admin" || (pathname.startsWith("/admin/") && !isAdminLogin(pathname));
}

function isAdminLogin(pathname: string): boolean {
  return pathname === "/admin/login";
}

function isParticipantArea(pathname: string): boolean {
  return pathname === "/mi-cuenta" || pathname.startsWith("/mi-cuenta/");
}

export function decideAccess(pathname: string, session: Session | null, sessionExpired: boolean): AccessDecision {
  if (isAdminArea(pathname)) {
    if (session === null) {
      return { type: "redirect", to: sessionExpired ? "/admin/login?motivo=expirada" : "/admin/login" };
    }
    if (session.role !== "admin") {
      return { type: "forbidden" };
    }
    return { type: "allow" };
  }

  if (isParticipantArea(pathname)) {
    if (session === null) {
      return { type: "redirect", to: sessionExpired ? "/login?motivo=expirada" : "/login" };
    }
    if (session.role !== "participant") {
      return { type: "redirect", to: "/admin" };
    }
    return { type: "allow" };
  }

  return { type: "allow" };
}
