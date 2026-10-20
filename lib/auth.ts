import "server-only";
import { redirect } from "next/navigation";
import type { ParticipantRow } from "@/types/database";
import { getParticipantById } from "./data";
import { readSession } from "./session";

/**
 * Verificación de sesión en páginas y acciones. El ID del participante
 * SIEMPRE sale de la cookie firmada, nunca de la URL ni del formulario.
 */

/** Para páginas de participante: redirige si no hay sesión válida. */
export async function requireParticipantPage(): Promise<ParticipantRow> {
  const { session, expired } = await readSession();
  if (session === null) {
    redirect(expired ? "/salir?motivo=expirada" : "/login");
  }
  if (session.role !== "participant") {
    redirect("/admin");
  }
  const participant = await getParticipantById(session.participantId);
  if (participant === null) {
    redirect("/salir?motivo=no-encontrado");
  }
  return participant;
}

/** Para páginas de administración: participante → acceso denegado. */
export async function requireAdminPage(): Promise<void> {
  const { session, expired } = await readSession();
  if (session === null) {
    redirect(expired ? "/salir?motivo=expirada&destino=admin" : "/admin/login");
  }
  if (session.role !== "admin") {
    redirect("/acceso-denegado");
  }
}

/** Para Server Actions de participante: devuelve null si no hay sesión válida. */
export async function currentParticipant(): Promise<ParticipantRow | null> {
  const { session } = await readSession();
  if (session === null || session.role !== "participant") {
    return null;
  }
  return getParticipantById(session.participantId);
}

/** Para Server Actions de administración. */
export async function isAdmin(): Promise<boolean> {
  const { session } = await readSession();
  return session !== null && session.role === "admin";
}
