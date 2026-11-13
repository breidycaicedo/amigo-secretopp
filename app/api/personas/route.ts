import { NextResponse, type NextRequest } from "next/server";
import { searchPeople } from "@/lib/data";
import { readSession } from "@/lib/session";
import { z } from "zod";

const gameIdSchema = z.string().uuid();

/**
 * Buscador para el campo "¿Quién te salió?". Solo devuelve id y nombre
 * (máximo 6 resultados, mínimo 2 letras). Nunca códigos, deseos ni asignaciones.
 */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const gameId = gameIdSchema.safeParse(request.nextUrl.searchParams.get("game"));
  if (!gameId.success) {
    return NextResponse.json({ people: [] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const { session } = await readSession();
    const excludeId = session !== null && session.role === "participant" ? session.participantId : undefined;
    const people = await searchPeople(gameId.data, query, excludeId);
    return NextResponse.json({ people }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ people: [], error: "No se pudo buscar en este momento." }, { status: 503 });
  }
}
