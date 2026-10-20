import type { Metadata } from "next";
import { ProfileForm } from "@/components/forms/profile-form";
import { GiftMark } from "@/components/gift-mark";
import { LogoutButton } from "@/components/logout-button";
import { PageShell } from "@/components/page-shell";
import { Badge, Card } from "@/components/ui";
import { WishlistView } from "@/components/wishlist-view";
import { requireParticipantPage } from "@/lib/auth";
import { getGiftFor, getSettings } from "@/lib/data";
import { canEditProfile, canEditWishlist, canSeeResult } from "@/lib/game-rules";

export const metadata: Metadata = { title: "Mi cuenta" };
export const dynamic = "force-dynamic";

export default async function MyAccountPage() {
  // El participante sale de la cookie firmada: no hay IDs en la URL.
  const me = await requireParticipantPage();
  const settings = await getSettings();
  const assigned = canSeeResult(settings.status);
  // Solo se consulta la persona que le corresponde a ESTE participante.
  const gift = assigned ? await getGiftFor(me.id) : null;
  const firstName = me.name.split(" ")[0];

  const editMode = canEditProfile(settings.status)
    ? "full"
    : canEditWishlist(settings.status, settings.allow_wishlist_edit_after_lock)
      ? "wishlist"
      : null;

  return (
    <PageShell actions={<LogoutButton />}>
      <div className="space-y-6">
        <div className="animate-rise">
          <p className="text-sm font-semibold text-gold-700">Hola, {firstName} 👋</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold text-berry-800">{me.name}</h1>
            <Badge>{me.student_code}</Badge>
          </div>
        </div>

        {gift ? (
          <Card className="confetti relative overflow-hidden text-center animate-pop">
            <GiftMark className="mx-auto h-16 w-16" />
            <p className="mt-4 font-display text-xl font-semibold text-berry-700">🎉 ¡Ya tienes tu amigo secreto!</p>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Te corresponde regalarle a:</p>
            <p className="mt-2 break-words font-display text-4xl font-bold uppercase tracking-tight text-ink sm:text-5xl">
              {gift.name}
            </p>
            <div className="mx-auto mt-8 max-w-md text-left">
              <p className="mb-3 text-sm font-semibold text-ink">Estas son sus ideas de regalo:</p>
              <WishlistView wishlist={gift.wishlist} emptyText="Aún no escribió su lista de deseos. ¡Sorpréndela/o!" />
            </div>
          </Card>
        ) : (
          <Card className="animate-rise">
            <div className="flex items-start gap-4">
              <GiftMark className="h-12 w-12 shrink-0" />
              <div>
                <h2 className="font-display text-xl font-semibold">🎁 Tu información está registrada.</h2>
                <p className="mt-1 text-muted">
                  {assigned
                    ? "No encontramos tu asignación. Habla con la administradora."
                    : "La administradora todavía no ha realizado la asignación definitiva."}
                </p>
                {!assigned ? (
                  <div className="mt-3">
                    {me.has_existing_assignment ? (
                      <Badge tone="gold">Papelito reportado: {me.reported_target_name}</Badge>
                    ) : (
                      <Badge tone="amber">Pendiente de asignación</Badge>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        )}

        <Card className="animate-rise" style={{ animationDelay: "80ms" }}>
          <h2 className="font-display text-xl font-semibold">
            {editMode === "full" ? "Mis datos" : "Mi lista de deseos"}
          </h2>
          <p className="mb-5 mt-1 text-sm text-muted">
            {editMode === "full"
              ? "Puedes editar tu información mientras el registro esté abierto."
              : editMode === "wishlist"
                ? "La administradora permite actualizar tu lista de deseos."
                : "El sorteo está cerrado; ya no se pueden hacer cambios."}
          </p>
          {editMode === null ? (
            <WishlistView wishlist={me.wishlist} emptyText="No escribiste una lista de deseos." />
          ) : (
            <ProfileForm
              mode={editMode}
              defaults={{
                name: me.name,
                wishlist: me.wishlist,
                hasPaper: me.has_existing_assignment,
                targetName: me.reported_target_name ?? "",
                targetId: me.reported_target_confirmed && me.reported_target_id ? me.reported_target_id : "",
              }}
            />
          )}
        </Card>
      </div>
    </PageShell>
  );
}
