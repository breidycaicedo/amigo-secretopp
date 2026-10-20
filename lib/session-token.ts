import { SignJWT, jwtVerify } from "jose";
import type { Session } from "@/types/domain";

/**
 * Firma y verificación de la cookie de sesión (JWT HS256).
 * No importa next/headers para poder usarse también desde proxy.ts.
 */

export const SESSION_COOKIE = "as_session";
export const PARTICIPANT_SESSION_SECONDS = 60 * 60 * 24 * 14; // 14 días
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8; // 8 horas

const ISSUER = "amigo-secreto";
const MIN_SECRET_LENGTH = 32;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error("SESSION_SECRET no está configurado o tiene menos de 32 caracteres.");
  }
  return new TextEncoder().encode(secret);
}

/** Huella del código admin: si ADMIN_CODE cambia, las sesiones admin viejas dejan de valer. */
async function adminFingerprint(): Promise<string> {
  const material = `${process.env.ADMIN_CODE ?? ""}|${process.env.ADMIN_PASSWORD ?? ""}|${process.env.SESSION_SECRET ?? ""}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 12; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export async function signSession(session: Session): Promise<string> {
  const isAdmin = session.role === "admin";
  const claims: Record<string, string> = { role: session.role };
  if (session.role === "participant") {
    claims.pid = session.participantId;
  } else {
    claims.afp = await adminFingerprint();
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${isAdmin ? ADMIN_SESSION_SECONDS : PARTICIPANT_SESSION_SECONDS}s`)
    .sign(secretKey());
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Devuelve la sesión si el token es válido; null si no existe, expiró o fue alterado. */
export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (token === undefined || token.length === 0) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, algorithms: ["HS256"] });
    if (payload.role === "participant" && typeof payload.pid === "string" && UUID_REGEX.test(payload.pid)) {
      return { role: "participant", participantId: payload.pid };
    }
    if (payload.role === "admin" && payload.afp === (await adminFingerprint())) {
      return { role: "admin" };
    }
    return null;
  } catch {
    return null;
  }
}
