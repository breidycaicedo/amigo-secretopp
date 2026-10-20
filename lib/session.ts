import "server-only";
import { cookies } from "next/headers";
import type { Session } from "@/types/domain";
import {
  ADMIN_SESSION_SECONDS,
  PARTICIPANT_SESSION_SECONDS,
  SESSION_COOKIE,
  signSession,
  verifySessionToken,
} from "./session-token";

/** Crea la cookie de sesión: httpOnly (JS no la puede leer), firmada y con expiración. */
export async function startSession(session: Session): Promise<void> {
  const token = await signSession(session);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: session.role === "admin" ? ADMIN_SESSION_SECONDS : PARTICIPANT_SESSION_SECONDS,
  });
}

export async function readSession(): Promise<{ session: Session | null; expired: boolean }> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  return { session, expired: token !== undefined && session === null };
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
