import type { Metadata } from "next";
import { CreateGameForm } from "@/components/admin/create-game-form";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { countParticipantsByGame, getSettings, listGames } from "@/lib/data";
import { STATUS_LABELS } from "@/lib/game-rules";

export const metadata: Metadata = { title: "Mis juegos" };
export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const [games, counts] = await Promise.all([listGames(), countParticipantsByGame()]);
  const settings = await Promise.all(games.map((game) => getSettings(game.id)));
  const statusById = new Map(settings.map((row) => [row.game_id, row.status]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-berry-800">🎁 Mis juegos</h1>
          <p className="text-muted">Cada grupo tiene su propio juego, su enlace y su sorteo independiente.</p>
        </div>

        {games.length === 0 ? (
          <Card className="text-center text-muted">Todavía no tienes juegos. Crea el primero a la derecha.</Card>
        ) : (
          games.map((game) => (
            <Card key={game.id} className="flex flex-wrap items-center justify-between gap-4 animate-rise">
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold">{game.name}</p>
                <p className="mt-1 break-all font-mono text-xs text-muted">/juego/{game.slug}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={statusById.get(game.id) === "ASSIGNED" ? "pine" : "gold"}>
                    {STATUS_LABELS[statusById.get(game.id) ?? "REGISTRATION_OPEN"]}
                  </Badge>
                  <Badge>
                    {counts.get(game.id) ?? 0} participante{(counts.get(game.id) ?? 0) === 1 ? "" : "s"}
                  </Badge>
                </div>
              </div>
              <ButtonLink href={`/admin/juegos/${game.slug}`} variant="secondary">
                Administrar
              </ButtonLink>
            </Card>
          ))
        )}
      </div>

      <aside>
        <Card className="space-y-4 animate-rise" style={{ animationDelay: "80ms" }}>
          <h2 className="font-display text-xl font-semibold">Crear un juego nuevo</h2>
          <p className="text-sm text-muted">
            Se genera un enlace propio. Compártelo solo con el grupo que va a jugar.
          </p>
          <CreateGameForm />
        </Card>
      </aside>
    </div>
  );
}
