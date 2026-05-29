import type {
  CustomBinding,
  ParsedKeyCombo,
  ShortcutRegistrationOptions,
} from "../domain/types/keyboard-types";

// --- From IShortcutCustomizer ---
/**
 * IShortcutCustomizer Contract
 *
 * Manages custom keyboard shortcut bindings.
 * Handles rebinding shortcuts, conflict detection, and effective binding resolution.
 *
 * Domain: Keyboard Shortcuts - Customization
 */



/**
 * Shortcut with its resolved (effective) binding
 */
export interface ShortcutWithBinding {
  /** Original shortcut registration */
  shortcut: ShortcutRegistrationOptions;

  /** Default binding from registration */
  defaultBinding: ParsedKeyCombo;

  /** Effective binding (custom if set, otherwise default) */
  effectiveBinding: ParsedKeyCombo;

  /** Custom binding if set */
  customBinding: CustomBinding | null;

  /** Whether this shortcut has a custom binding */
  isCustomized: boolean;

  /** Whether this shortcut is disabled */
  isDisabled: boolean;
}

// --- From IGreekKeyMapper ---
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
