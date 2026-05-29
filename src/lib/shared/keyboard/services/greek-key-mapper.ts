/**
 * Greek Key Mapper
 *
 * Maps physical keyboard codes to TKA Greek symbols using event.code
 * (not event.key) to distinguish number row from numpad.
 *
 * Number row (1-7): sequence letters used in TKA words
 * Numpad (1-7): Type 6 static/position letters
 * Numpad minus: dash suffix for Type 3/4/5 letters
 */

import type { GreekKeyMapping } from "./types";

const NUMBER_ROW_MAPPINGS: readonly GreekKeyMapping[] = [
  { code: "Digit1", symbol: "Σ", label: "Sigma", group: "number-row" },
  { code: "Digit2", symbol: "Δ", label: "Delta", group: "number-row" },
  { code: "Digit3", symbol: "Θ", label: "Theta", group: "number-row" },
  { code: "Digit4", symbol: "Ω", label: "Omega", group: "number-row" },
  { code: "Digit5", symbol: "Φ", label: "Phi", group: "number-row" },
  { code: "Digit6", symbol: "Ψ", label: "Psi", group: "number-row" },
  { code: "Digit7", symbol: "Λ", label: "Lambda", group: "number-row" },
] as const;

const NUMPAD_MAPPINGS: readonly GreekKeyMapping[] = [
  { code: "Numpad1", symbol: "α", label: "Alpha", group: "numpad" },
  { code: "Numpad2", symbol: "β", label: "Beta", group: "numpad" },
  { code: "Numpad3", symbol: "γ", label: "Gamma", group: "numpad" },
  { code: "Numpad4", symbol: "ζ", label: "Zeta", group: "numpad" },
  { code: "Numpad5", symbol: "η", label: "Eta", group: "numpad" },
  { code: "Numpad6", symbol: "τ", label: "Tau", group: "numpad" },
  { code: "Numpad7", symbol: "⊕", label: "Terra", group: "numpad" },
  { code: "NumpadSubtract", symbol: "-", label: "Dash suffix", group: "numpad" },
] as const;

const ALL_MAPPINGS: readonly GreekKeyMapping[] = [
  ...NUMBER_ROW_MAPPINGS,
  ...NUMPAD_MAPPINGS,
];

/** Pre-built lookup for O(1) code → symbol resolution */
const SYMBOL_MAP = new Map<string, string>(
  ALL_MAPPINGS.map((m) => [m.code, m.symbol])
);

export function getGreekSymbol(code: string): string | null {
  return SYMBOL_MAP.get(code) ?? null;
}

export function isGreekKeyMapped(code: string): boolean {
  return SYMBOL_MAP.has(code);
}

export function getAllGreekKeyMappings(): readonly GreekKeyMapping[] {
  return ALL_MAPPINGS;
}

export function getNumberRowMappings(): readonly GreekKeyMapping[] {
  return NUMBER_ROW_MAPPINGS;
}

export function getNumpadMappings(): readonly GreekKeyMapping[] {
  return NUMPAD_MAPPINGS;
}
