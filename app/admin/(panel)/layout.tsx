import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { PageShell } from "@/components/page-shell";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/participantes", label: "Participantes" },
  { href: "/admin/asignaciones", label: "Asignaciones" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Segunda verificación (además de proxy.ts): solo la administradora.
  await requireAdminPage();
  return (
    <PageShell width="wide" label="Admin" actions={<LogoutButton />}>
      <nav aria-label="Administración" className="-mx-1 mb-6 flex gap-1 overflow-x-auto pb-1">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-muted ring-1 ring-transparent transition hover:bg-paper hover:text-berry-700 hover:ring-line"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </PageShell>
  );
}
