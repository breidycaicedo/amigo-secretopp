import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseServiceKey, supabaseUrl } from "./env";

/**
 * Cliente de Supabase SOLO para el servidor. Usa la clave secreta, que nunca
 * llega al navegador (este módulo importa "server-only": si un componente de
 * cliente lo importara por error, la compilación fallaría).
 */
let client: SupabaseClient<Database> | null = null;

export function db(): SupabaseClient<Database> {
  if (client === null) {
    client = createClient<Database>(supabaseUrl(), supabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
