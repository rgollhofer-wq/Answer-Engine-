import type { Pattern } from "../types";

export function anyPatternMatches(
  raw: string,
  norm: string,
  slots: Record<string, any>,
  patterns: Pattern[]
): boolean {
  for (const p of patterns) {
    if (p instanceof RegExp) {
      if (p.test(norm)) return true;
    } else {
      if (p({ raw, norm, slots })) return true;
    }
  }
  return false;
}

export function firstRegexMatch(
  norm: string,
  patterns: Pattern[]
): RegExpMatchArray | undefined {
  for (const p of patterns) {
    if (p instanceof RegExp) {
      const m = norm.match(p);
      if (m) return m;
    }
  }
  return undefined;
}

export function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
