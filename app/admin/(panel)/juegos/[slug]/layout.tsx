import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CopyLink } from "@/components/admin/copy-link";
import { getGameBySlug } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { children: ReactNode; params: Promise<{ slug: string }> };

export default async function GameLayout({ children, params }: Props) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (game === null) {
    notFound();
  }
  const base = `/admin/juegos/${game.slug}`;
  const links = [
    { href: base, label: "Panel" },
    { href: `${base}/participantes`, label: "Participantes" },
    { href: `${base}/asignaciones`, label: "Asignaciones" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 animate-rise">
        <div>
          <p className="text-sm font-semibold text-gold-700">
            <Link href="/admin" className="underline-offset-4 hover:underline">
              Mis juegos
            </Link>{" "}
            / {game.name}
          </p>
          <p className="mt-2 text-sm text-muted">Enlace para compartir con el grupo:</p>
          <div className="mt-1">
            <CopyLink path={`/juego/${game.slug}`} />
          </div>
        </div>
      </div>
      <nav aria-label="Juego" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {links.map((link) => (
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
    </div>
  );
}
