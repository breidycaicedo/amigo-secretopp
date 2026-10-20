import { describe, expect, it } from "vitest";
import { decideAccess } from "@/lib/access";
import { canEditProfile, canEditWishlist, canRegister, canRunAssignment, canSeeResult } from "@/lib/game-rules";

const participant = { role: "participant", participantId: "6f1c2c7e-0000-4000-8000-000000000001" } as const;
const admin = { role: "admin" } as const;

describe("seguridad de rutas", () => {
  it.each(["/admin", "/admin/participantes", "/admin/asignaciones"])("participante en %s → 403", (path) => {
    expect(decideAccess(path, participant, false)).toEqual({ type: "forbidden" });
  });

  it("sin sesión en /admin → login de administración", () => {
    expect(decideAccess("/admin", null, false)).toEqual({ type: "redirect", to: "/admin/login" });
  });

  it("sesión expirada en /mi-cuenta → login con aviso", () => {
    expect(decideAccess("/mi-cuenta", null, true)).toEqual({ type: "redirect", to: "/login?motivo=expirada" });
  });

  it("la página de login de administración es pública", () => {
    expect(decideAccess("/admin/login", null, false)).toEqual({ type: "allow" });
    expect(decideAccess("/admin/login", participant, false)).toEqual({ type: "allow" });
  });

  it("administradora entra al panel; participante a su cuenta", () => {
    expect(decideAccess("/admin/asignaciones", admin, false)).toEqual({ type: "allow" });
    expect(decideAccess("/mi-cuenta", participant, false)).toEqual({ type: "allow" });
  });

  it("rutas parecidas no se confunden", () => {
    expect(decideAccess("/administrador", participant, false)).toEqual({ type: "allow" });
  });
});

describe("estados del juego", () => {
  it("REGISTRATION_OPEN permite registro y edición", () => {
    expect(canRegister("REGISTRATION_OPEN")).toBe(true);
    expect(canEditProfile("REGISTRATION_OPEN")).toBe(true);
    expect(canSeeResult("REGISTRATION_OPEN")).toBe(false);
  });

  it("ASSIGNING bloquea cambios", () => {
    expect(canRegister("ASSIGNING")).toBe(false);
    expect(canEditProfile("ASSIGNING")).toBe(false);
    expect(canEditWishlist("ASSIGNING", true)).toBe(false);
    expect(canRunAssignment("ASSIGNING")).toBe(false);
  });

  it("ASSIGNED bloquea el sorteo y solo permite deseos si la admin lo autoriza", () => {
    expect(canRunAssignment("ASSIGNED")).toBe(false);
    expect(canRegister("ASSIGNED")).toBe(false);
    expect(canEditWishlist("ASSIGNED", false)).toBe(false);
    expect(canEditWishlist("ASSIGNED", true)).toBe(true);
    expect(canSeeResult("ASSIGNED")).toBe(true);
  });
});
