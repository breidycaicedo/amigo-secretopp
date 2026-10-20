import "server-only";
import { headers } from "next/headers";
import type { LoginScope } from "@/types/database";
import { db } from "./supabase";

/**
 * Limitador simple contra fuerza bruta de códigos: máximo N intentos
 * fallidos por dispositivo/IP en una ventana de tiempo. La IP se guarda
 * como hash, nunca en texto plano.
 */
const WINDOW_MINUTES = 15;
const MAX_FAILURES: Record<LoginScope, number> = { participant: 10, admin: 5 };

async function clientKey(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() || list.get("x-real-ip") || "desconocido";
  const material = `${ip}|${process.env.SESSION_SECRET ?? ""}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function windowStart(): string {
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
}

export async function isRateLimited(scope: LoginScope): Promise<boolean> {
  const key = await clientKey();
  const { count, error } = await db()
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("scope", scope)
    .eq("client_key", key)
    .gte("created_at", windowStart());
  if (error) {
    // Si el limitador falla, no bloqueamos el acceso legítimo.
    return false;
  }
  return (count ?? 0) >= MAX_FAILURES[scope];
}

export async function recordFailure(scope: LoginScope): Promise<void> {
  const key = await clientKey();
  await db().from("login_attempts").insert({ scope, client_key: key });
  // Limpieza ocasional de registros viejos.
  if (Math.random() < 0.1) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await db().from("login_attempts").delete().lt("created_at", dayAgo);
  }
}

export async function clearFailures(scope: LoginScope): Promise<void> {
  const key = await clientKey();
  await db().from("login_attempts").delete().eq("scope", scope).eq("client_key", key);
}
