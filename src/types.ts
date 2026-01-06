export type Domain = "BBL" | "LP";

export type SlotValue =
  | string
  | number
  | boolean
  | string[]
  | null;

export type Slots = Record<string, SlotValue>;

export type InterpretStatus = "ok" | "clarify" | "no_match";

export interface InterpretInput {
  domain: Domain;
  text: string;
}

export interface InterpretResult {
  status: InterpretStatus;
  domain: Domain;
  intent: string;
  confidence: number; // 0..1
  slots: Slots;
  clarifyQuestion?: string;
  matchedRules?: string[]; // debug only
}

export type Pattern =
  | RegExp
  | ((ctx: { raw: string; norm: string; slots: Slots }) => boolean);

export interface Rule {
  id: string;
  intent: string;
  weight: number;
  patterns: Pattern[];
  extract?: (
    ctx: { raw: string; norm: string; slots: Slots },
    match?: RegExpMatchArray
  ) => void;
  when?: (ctx: { raw: string; norm: string; slots: Slots }) => boolean;
}

export interface Pack {
  domain: Domain;
  rules: Rule[];
  noMatchQuestion: string;
  clarifyQuestion: (topIntent: string) => string;
  thresholds: {
    clarify: number;
    noMatch: number;
  };
}
