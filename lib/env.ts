import "server-only";
import { isValidStudentCode } from "./validation";

/** Lee variables de entorno del servidor con mensajes claros si faltan. */

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa .env.local o la configuración de Vercel.`);
  }
  return value;
}

export function supabaseUrl(): string {
  return required("SUPABASE_URL");
}

export function supabaseServiceKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function adminCode(): string {
  const code = required("ADMIN_CODE").toUpperCase();
  if (!isValidStudentCode(code)) {
    throw new Error("ADMIN_CODE debe tener el formato A00xxxxxx.");
  }
  return code;
}

/** Contraseña opcional para Administración. Cadena vacía = no se pide. */
export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}
