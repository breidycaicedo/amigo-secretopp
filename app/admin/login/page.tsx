import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/forms/admin-login-form";
import { PageShell } from "@/components/page-shell";
import { Alert, Card } from "@/components/ui";
import { adminPassword } from "@/lib/env";
import { ERRORS } from "@/lib/errors";

export const metadata: Metadata = { title: "Administración" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  return (
    <PageShell label="Admin">
      <Card className="animate-rise">
        <h1 className="font-display text-3xl font-semibold text-berry-800">Administración</h1>
        <p className="mt-2 mb-6 text-muted">Acceso exclusivo para la administradora del juego.</p>
        {motivo === "expirada" ? (
          <div className="mb-5">
            <Alert tone="amber">{ERRORS.SESSION_EXPIRED}</Alert>
          </div>
        ) : null}
        <AdminLoginForm requiresPassword={adminPassword().length > 0} />
      </Card>
    </PageShell>
  );
}
