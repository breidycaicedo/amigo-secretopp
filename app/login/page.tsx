import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";
import { PageShell } from "@/components/page-shell";
import { Alert, Card } from "@/components/ui";
import { ERRORS } from "@/lib/errors";

export const metadata: Metadata = { title: "Entrar" };

const REASONS: Record<string, string> = {
  expirada: ERRORS.SESSION_EXPIRED,
  "no-encontrado": "Tu registro ya no existe. Si crees que es un error, habla con la administradora.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  const reason = motivo === undefined ? undefined : REASONS[motivo];
  return (
    <PageShell>
      <Card className="animate-rise">
        <h1 className="font-display text-3xl font-semibold text-berry-800">Entrar</h1>
        <p className="mt-2 mb-6 text-muted">Escribe tu código de estudiante para ver tu información.</p>
        {reason ? (
          <div className="mb-5">
            <Alert tone="amber">{reason}</Alert>
          </div>
        ) : null}
        <LoginForm />
      </Card>
      <p className="mt-6 text-center text-sm text-muted">
        ¿Aún no te registras?{" "}
        <Link href="/registro" className="font-semibold text-berry-700 underline-offset-4 hover:underline">
          Regístrate aquí
        </Link>
      </p>
    </PageShell>
  );
}
