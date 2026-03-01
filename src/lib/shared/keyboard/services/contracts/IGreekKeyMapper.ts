/**
 * IGreekKeyMapper Contract
 *
 * Maps physical keyboard codes (event.code) to TKA Greek symbols.
 * Number row (Digit1-7) maps to sequence letters (Σ, Δ, Θ, etc.).
 * Numpad (Numpad1-7) maps to Type 6 position letters (α, β, γ, etc.).
 * NumpadSubtract maps to the dash suffix "-".
 *
 * Domain: Keyboard Input
 */

export interface GreekKeyMapping {
  readonly code: string;
  readonly symbol: string;
  readonly label: string;
  readonly group: "number-row" | "numpad";
}

export interface IGreekKeyMapper {
  /**
   * Get the TKA symbol for a physical key code.
   * Returns null if the code is not mapped.
   */
  getSymbol(code: string): string | null;

  /**
   * Check if a physical key code has a Greek/TKA mapping.
   */
  isMapped(code: string): boolean;

  /**
   * Get all mappings for display purposes.
   */
  getAllMappings(): readonly GreekKeyMapping[];

  /**
   * Get only number row mappings (Digit1-7 → Σ, Δ, Θ, etc.).
   */
  getNumberRowMappings(): readonly GreekKeyMapping[];

  /**
   * Get only numpad mappings (Numpad1-7 → α, β, γ, etc. + NumpadSubtract → -).
   */
  getNumpadMappings(): readonly GreekKeyMapping[];
}
