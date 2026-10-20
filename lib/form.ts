/** Lee un campo de texto de un FormData (cadena vacía si no existe). */
export function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
