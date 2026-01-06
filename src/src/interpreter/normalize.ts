export function normalizeText(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ");
}
