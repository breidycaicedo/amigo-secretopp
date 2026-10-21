import { describe, expect, it } from "vitest";
import { findCandidates, normalizeName, reportedNameMatches } from "@/lib/names";
import { buildAdminSummary } from "@/lib/review";
import { wishlistItems } from "@/lib/wishlist";
import type { ParticipantRow } from "@/types/database";

const people = [
  { id: "1", name: "Gabriela López", name_normalized: normalizeName("Gabriela López") },
  { id: "2", name: "Gabriela Martínez", name_normalized: normalizeName("Gabriela Martínez") },
  { id: "3", name: "Juan Pérez", name_normalized: normalizeName("Juan Pérez") },
];

describe("relacionar nombres con participantes", () => {
  it("normaliza tildes, mayúsculas y espacios", () => {
    expect(normalizeName("  GABRIELA   lópez ")).toBe("gabriela lopez");
  });

  it("«Gabriela» es ambiguo → dos opciones", () => {
    expect(findCandidates("Gabriela", people).map((p) => p.name)).toEqual(["Gabriela López", "Gabriela Martínez"]);
  });

  it("«gabriela lopez» identifica a una sola persona", () => {
    expect(findCandidates("gabriela lopez", people)).toEqual([{ id: "1", name: "Gabriela López" }]);
  });

  it("no confunde prefijos con palabras completas", () => {
    expect(reportedNameMatches("gabi", normalizeName("Gabriela López"))).toBe(false);
  });
});

function row(partial: Partial<ParticipantRow> & { id: string; name: string }): ParticipantRow {
  return {
    name_normalized: normalizeName(partial.name),
    student_code: "A00000000",
    wishlist: "",
    wishlist_photos: [],
    has_existing_assignment: false,
    reported_target_name: null,
    reported_target_id: null,
    reported_target_confirmed: false,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("resumen de administración", () => {
  it("cuenta registrados, faltantes y estados", () => {
    const rows = [
      row({ id: "a", name: "Brendy", has_existing_assignment: true, reported_target_name: "Gabriela", reported_target_id: "b", reported_target_confirmed: true }),
      row({ id: "b", name: "Gabriela" }),
      row({ id: "c", name: "Carlos", has_existing_assignment: true, reported_target_name: "Ana" }),
    ];
    const summary = buildAdminSummary(rows, 5);
    expect(summary.registered).toBe(3);
    expect(summary.missing).toBe(2);
    expect(summary.existing).toBe(2);
    expect(summary.toResolve).toBe(1);
    expect(summary.unresolvedReferences).toBe(1);
    expect(summary.reviews.map((r) => r.status)).toEqual(["OK", "PENDING", "UNRESOLVED_REFERENCE"]);
    expect(summary.problems).toHaveLength(1);
  });

  it("marca conflicto cuando dos papelitos apuntan a la misma persona", () => {
    const rows = [
      row({ id: "a", name: "A", has_existing_assignment: true, reported_target_name: "B", reported_target_id: "b", reported_target_confirmed: true }),
      row({ id: "b", name: "B" }),
      row({ id: "c", name: "C", has_existing_assignment: true, reported_target_name: "B", reported_target_id: "b", reported_target_confirmed: true }),
    ];
    const summary = buildAdminSummary(rows, 3);
    expect(summary.reviews[0].status).toBe("CONFLICT");
    expect(summary.problems[0]).toContain("varios papelitos");
  });
});

describe("lista de deseos", () => {
  it("separa líneas y quita viñetas", () => {
    expect(wishlistItems("- Chocolates\n\n* Libro\n1. Perfume\n• Camiseta")).toEqual(["Chocolates", "Libro", "Perfume", "Camiseta"]);
  });
});
