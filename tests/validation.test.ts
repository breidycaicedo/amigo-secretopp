import { describe, expect, it } from "vitest";
import { cleanStudentCode, isValidStudentCode, paperSchema, studentCodeSchema } from "@/lib/validation";

describe("código de estudiante ^A00\\d{6}$", () => {
  it.each(["A00123456", "A00987654", "A00000001"])("%s es válido", (code) => {
    expect(isValidStudentCode(code)).toBe(true);
  });

  it.each(["00123456", "B00123456", "A01234567", "A0012345", "A001234567", "A00ABC123", "", "A00 123456"])(
    "%s es inválido",
    (code) => {
      expect(isValidStudentCode(code)).toBe(false);
    },
  );

  it("limpia espacios y minúsculas antes de validar", () => {
    expect(cleanStudentCode(" a00 123 456 ")).toBe("A00123456");
    expect(studentCodeSchema.safeParse("a00123456").success).toBe(true);
    expect(studentCodeSchema.safeParse("b00123456").success).toBe(false);
  });
});

describe("información del papelito", () => {
  it("sin papelito no guarda nombre", () => {
    const result = paperSchema.parse({ hasPaper: "no", targetName: "Gabriela" });
    expect(result).toEqual({ hasExistingAssignment: false });
  });

  it("con papelito exige el nombre", () => {
    expect(paperSchema.safeParse({ hasPaper: "yes", targetName: "" }).success).toBe(false);
    expect(paperSchema.safeParse({ hasPaper: "yes", targetName: "Gabriela" }).success).toBe(true);
  });

  it("rechaza IDs manipulados", () => {
    expect(paperSchema.safeParse({ hasPaper: "yes", targetName: "Gabriela", targetId: "1 OR 1=1" }).success).toBe(false);
  });

  it("exige elegir una opción", () => {
    expect(paperSchema.safeParse({ hasPaper: "" }).success).toBe(false);
  });
});
