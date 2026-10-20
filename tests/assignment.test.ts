import { describe, expect, it } from "vitest";
import {
  analyzeAssignments,
  matchPending,
  planAssignments,
  verifyAssignments,
  type AssignmentParticipant,
  type PlannedAssignment,
} from "@/lib/assignment";

function person(id: string, target?: string | null): AssignmentParticipant {
  if (target === undefined) {
    return { id, name: id, hasExistingAssignment: false, reportedTargetName: null, reportedTargetId: null };
  }
  return { id, name: id, hasExistingAssignment: true, reportedTargetName: target ?? "Alguien", reportedTargetId: target };
}

function expectValid(participants: AssignmentParticipant[], assignments: PlannedAssignment[]) {
  expect(verifyAssignments(participants, assignments)).toBeNull();
}

describe("validación de combinaciones (rúbrica)", () => {
  it("A → B, B → C, C → A es válido y se conserva tal cual", () => {
    const people = [person("A", "B"), person("B", "C"), person("C", "A")];
    const plan = planAssignments(people);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expectValid(people, plan.assignments);
      expect(plan.assignments.every((a) => a.source === "EXISTING")).toBe(true);
    }
  });

  it("A → A es inválido", () => {
    const plan = planAssignments([person("A", "A"), person("B"), person("C")]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.problems[0].kind).toBe("SELF_ASSIGNMENT");
    }
  });

  it("A → B y C → B es inválido (B recibiría dos regalos)", () => {
    const plan = planAssignments([person("A", "B"), person("B"), person("C", "B")]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.problems.some((p) => p.kind === "DUPLICATE_RECEIVER")).toBe(true);
    }
  });

  it("parejas recíprocas son válidas (A ↔ B)", () => {
    const people = [person("A", "B"), person("B", "A"), person("C"), person("D")];
    const plan = planAssignments(people);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expectValid(people, plan.assignments);
    }
  });

  it("papelito con nombre sin vincular bloquea el sorteo (no se descarta)", () => {
    const plan = planAssignments([person("A", null), person("B"), person("C")]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.problems[0].kind).toBe("UNRESOLVED_REFERENCE");
    }
  });

  it("papelito hacia alguien que no existe es inválido", () => {
    const plan = planAssignments([person("A", "Z"), person("B"), person("C")]);
    expect(plan.ok).toBe(false);
  });

  it("menos de 2 participantes es inválido", () => {
    expect(planAssignments([person("A")]).ok).toBe(false);
  });
});

describe("conserva papelitos y solo resuelve huecos", () => {
  it("ejemplo del enunciado: Brendy→Gabriela, Carlos→Ana, Juan→Pedro", () => {
    const people = [
      person("Brendy", "Gabriela"),
      person("Gabriela"),
      person("Carlos", "Ana"),
      person("Juan", "Pedro"),
      person("Ana"),
      person("Pedro"),
    ];
    const analysis = analyzeAssignments(people);
    expect(analysis.pendingGivers.sort()).toEqual(["Ana", "Gabriela", "Pedro"]);
    expect(analysis.freeReceivers.sort()).toEqual(["Brendy", "Carlos", "Juan"]);

    for (let run = 0; run < 200; run++) {
      const plan = planAssignments(people);
      expect(plan.ok).toBe(true);
      if (plan.ok) {
        expectValid(people, plan.assignments);
        const brendy = plan.assignments.find((a) => a.giverId === "Brendy");
        expect(brendy).toEqual({ giverId: "Brendy", receiverId: "Gabriela", source: "EXISTING" });
      }
    }
  });

  it("caso imposible: el único pendiente es también el único sin quien le regale", () => {
    // A→B, B→C, C quedó sin papelito y nadie tiene a A... salvo C. Bien.
    // Imposible: A→B, B→A, C sin papelito → C solo podría regalarse a sí mismo.
    const plan = planAssignments([person("A", "B"), person("B", "A"), person("C")]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.problems[0].kind).toBe("IMPOSSIBLE");
      expect(plan.problems[0].message).toContain("C");
    }
  });

  it("todos sin papelito: sorteo completo válido (sin autoasignaciones)", () => {
    const people = ["A", "B", "C", "D", "E", "F", "G", "H"].map((id) => person(id));
    for (let run = 0; run < 300; run++) {
      const plan = planAssignments(people);
      expect(plan.ok).toBe(true);
      if (plan.ok) {
        expectValid(people, plan.assignments);
      }
    }
  });

  it("propiedad: con papelitos aleatorios válidos siempre encuentra resultado o explica el problema", () => {
    for (let run = 0; run < 500; run++) {
      const size = 2 + Math.floor(Math.random() * 14);
      const ids = Array.from({ length: size }, (_, i) => `P${i}`);
      const receivers = [...ids].sort(() => Math.random() - 0.5);
      const used = new Set<string>();
      const people = ids.map((id, index) => {
        const receiver = receivers[index];
        if (Math.random() < 0.5 && receiver !== id && !used.has(receiver)) {
          used.add(receiver);
          return person(id, receiver);
        }
        return person(id);
      });
      const plan = planAssignments(people);
      if (plan.ok) {
        expectValid(people, plan.assignments);
      } else {
        expect(plan.problems[0].kind).toBe("IMPOSSIBLE");
        const analysis = analyzeAssignments(people);
        expect(analysis.pendingGivers).toEqual(analysis.freeReceivers);
        expect(analysis.pendingGivers).toHaveLength(1);
      }
    }
  });
});

describe("aleatoriedad", () => {
  it("elige uniformemente entre las soluciones válidas (3 pendientes → 2 desarreglos)", () => {
    const counts = new Map<string, number>();
    for (let run = 0; run < 4000; run++) {
      const match = matchPending(["A", "B", "C"], ["A", "B", "C"]);
      expect(match).not.toBeNull();
      const key = `${match?.get("A")}${match?.get("B")}${match?.get("C")}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(["BCA", "CAB"]);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(1700);
      expect(count).toBeLessThan(2300);
    }
  });

  it("usa backtracking si el muestreo por rechazo nunca acierta", () => {
    // Un generador "trampa" que siempre deja todo en su lugar.
    const alwaysZero = () => 0;
    const match = matchPending(["A", "B", "C", "D"], ["A", "B", "C", "D"], alwaysZero);
    expect(match).not.toBeNull();
    for (const [giver, receiver] of match ?? new Map<string, string>()) {
      expect(giver).not.toBe(receiver);
    }
  });

  it("un solo pendiente que es su propio receptor no tiene solución", () => {
    expect(matchPending(["A"], ["A"])).toBeNull();
    expect(matchPending(["A"], ["B"])?.get("A")).toBe("B");
  });
});
