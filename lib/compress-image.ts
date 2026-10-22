/**
 * Reduce una foto en el navegador antes de subirla (las del celular pesan
 * 3–8 MB; así quedan en ~300 KB) y quita metadatos como la ubicación GPS.
 * Solo se usa desde componentes de cliente.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("canvas");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob"))), "image/jpeg", QUALITY);
  });
}

export const UNREADABLE_IMAGE =
  "No pudimos leer esa imagen. Prueba con una foto JPG o PNG (o una captura de pantalla).";
