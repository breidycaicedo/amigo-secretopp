import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";

/** Cierra una sesión inválida o expirada y redirige con el motivo. */
export function GET(request: NextRequest) {
  const motivo = request.nextUrl.searchParams.get("motivo");
  const destino = request.nextUrl.searchParams.get("destino");
  const base = destino === "admin" ? "/admin/login" : "/login";
  const safeReason = motivo === "expirada" || motivo === "no-encontrado" ? motivo : null;
  const target = new URL(safeReason === null ? base : `${base}?motivo=${safeReason}`, request.url);
  const response = NextResponse.redirect(target);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
