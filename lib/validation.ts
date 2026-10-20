import { z } from "zod";

/** Formato obligatorio del código de estudiante: A00 + 6 dígitos. */
export const STUDENT_CODE_REGEX = /^A00\d{6}$/;

export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const WISHLIST_MAX = 2000;

/**
 * Limpia lo que escribe la persona: quita espacios y pasa a mayúsculas
 * ("a00 123 456" → "A00123456"). El resultado igual debe cumplir la regex.
 */
export function cleanStudentCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function isValidStudentCode(code: string): boolean {
  return STUDENT_CODE_REGEX.test(code);
}

/** Colapsa espacios repetidos y recorta extremos. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/^ | $/g, "");
}

/** Normaliza saltos de línea y quita líneas vacías al final. */
export function cleanWishlist(raw: string): string {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    kept.push(line.replace(/\s+$/, ""));
  }
  return kept.join("\n").replace(/^\n+|\n+$/g, "");
}

export const studentCodeSchema = z
  .string({ error: "Escribe tu código de estudiante." })
  .transform(cleanStudentCode)
  .refine((value) => value.length > 0, { message: "Escribe tu código de estudiante." })
  .refine(isValidStudentCode, {
    message: "El código debe tener el formato A00 seguido de 6 dígitos (ej. A00123456).",
  });

export const nameSchema = z
  .string({ error: "Escribe tu nombre completo." })
  .transform(cleanName)
  .refine((value) => value.length >= NAME_MIN, { message: "Escribe tu nombre completo." })
  .refine((value) => value.length <= NAME_MAX, {
    message: `El nombre no puede tener más de ${NAME_MAX} caracteres.`,
  });

export const wishlistSchema = z
  .string()
  .optional()
  .transform((value) => cleanWishlist(value ?? ""))
  .refine((value) => value.length <= WISHLIST_MAX, {
    message: `La lista de deseos no puede superar ${WISHLIST_MAX} caracteres.`,
  });

const uuidSchema = z.string().uuid();

/** Información del papelito, común a registro y edición. */
export const paperSchema = z
  .object({
    hasPaper: z.enum(["yes", "no"], { error: "Indica si tienes una persona asignada." }),
    targetName: z.string().optional(),
    targetId: z.string().optional(),
    targetUnregistered: z.string().optional(),
  })
  .transform((value, ctx) => {
    if (value.hasPaper === "no") {
      return { hasExistingAssignment: false as const };
    }
    const targetName = cleanName(value.targetName ?? "");
    if (targetName.length < NAME_MIN || targetName.length > NAME_MAX) {
      ctx.addIssue({
        code: "custom",
        path: ["targetName"],
        message: "Escribe el nombre de la persona que te salió.",
      });
      return z.NEVER;
    }
    const rawId = value.targetId ?? "";
    let targetId: string | null = null;
    if (rawId.length > 0) {
      if (!uuidSchema.safeParse(rawId).success) {
        ctx.addIssue({ code: "custom", path: ["targetName"], message: "Persona no encontrada." });
        return z.NEVER;
      }
      targetId = rawId;
    }
    return {
      hasExistingAssignment: true as const,
      targetName,
      targetId,
      targetUnregistered: value.targetUnregistered === "1",
    };
  });

export type PaperInput = z.output<typeof paperSchema>;

/** Convierte los errores de Zod en un mapa campo → mensaje. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
    if (result[key] === undefined) {
      result[key] = issue.message;
    }
  }
  return result;
}
