/** Separa la lista de deseos en ítems, quitando viñetas escritas a mano. */
export function wishlistItems(wishlist: string): string[] {
  const items: string[] = [];
  for (const line of wishlist.split("\n")) {
    const item = line.replace(/^\s*(?:[-*•·–]|\d+[.)])\s*/, "").trim();
    if (item.length > 0) {
      items.push(item);
    }
  }
  return items;
}

const ICONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/chocolat|dulce|galleta|snack|caramel|torta|postre/i, "🍫"],
  [/libro|novela|comic|cómic|poema|poesía|poesia/i, "📚"],
  [/camis|ropa|buzo|saco|chaqueta|pantal|medias|talla|gorra|vestido/i, "👕"],
  [/perfum|colonia|crema|maquill|skincare|labial/i, "🌸"],
  [/taza|mug|caf[eé]|t[eé]\b/i, "☕"],
  [/aud[ií]fono|parlante|tecnolog|cargador|mouse|teclado|usb/i, "🎧"],
  [/planta|flor|suculenta/i, "🪴"],
  [/juego|lego|rompecabezas|puzzle|cartas/i, "🎲"],
  [/arte|pintura|cuaderno|libreta|agenda|esfero|marcador/i, "🎨"],
];

/** Elige un ícono discreto según el contenido del ítem. */
export function wishlistIcon(item: string): string {
  for (const [pattern, icon] of ICONS) {
    if (pattern.test(item)) {
      return icon;
    }
  }
  return "✨";
}
