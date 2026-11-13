import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoginForm } from "@/components/forms/login-form";
import { PageShell } from "@/components/page-shell";
import { Alert, Card } from "@/components/ui";
import { getGameBySlug } from "@/lib/data";
import { ERRORS } from "@/lib/errors";

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  expirada: ERRORS.SESSION_EXPIRED,
  "no-encontrado": "Tu registro ya no existe. Si crees que es un error, habla con la administradora.",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  return { title: game ? `Entrar · ${game.name}` : "Entrar" };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (game === null) {
    notFound();
  }
  const { motivo } = await searchParams;
  const reason = motivo === undefined ? undefined : REASONS[motivo];
  return (
    <PageShell>
      <Card className="animate-rise">
        <h1 className="font-display text-3xl font-semibold text-berry-800">Entrar</h1>
        <p className="mt-2 mb-6 text-muted">
          Escribe tu código de estudiante para ver tu información en <strong className="text-ink">{game.name}</strong>.
        </p>
        {reason ? (
          <div className="mb-5">
            <Alert tone="amber">{reason}</Alert>
          </div>
        ) : null}
        <LoginForm gameId={game.id} />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        ¿Aún no te registras?{" "}
        <Link href={`/juego/${game.slug}/registro`} className="font-semibold text-berry-700 underline-offset-4 hover:underline">
          Regístrate aquí
        </Link>
      </p>
    </PageShell>
  );
}
