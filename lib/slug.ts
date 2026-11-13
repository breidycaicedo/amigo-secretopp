import "server-only";
import { randomInt } from "node:crypto";
import { normalizeName } from "./names";

/**
 * Enlaces de cada juego: "Grupo 8" → "grupo-8-k7q2".
 * El sufijo aleatorio evita adivinar enlaces de otros grupos.
 */

const SUFFIX_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const SLUG_MAX_BASE = 40;

export function slugBase(name: string): string {
  const base = normalizeName(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_BASE)
    .replace(/-+$/g, "");
  return base.length > 0 ? base : "juego";
}

export function randomSuffix(length = 4): string {
  let suffix = "";
  for (let i = 0; i < length; i++) {
    suffix += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  }
  return suffix;
}

export function newGameSlug(name: string): string {
  return `${slugBase(name)}-${randomSuffix()}`;
}
