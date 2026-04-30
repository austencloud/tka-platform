/**
 * Greek Input Helpers
 *
 * Pure functions for handling TKA Greek symbol input.
 * Separated from service classes because these are stateless transforms
 * used by multiple input components.
 *
 * Domain: Keyboard Input
 */

/**
 * Characters that must NOT be uppercased.
 * Greek lowercase (α, β, γ, ζ, η, τ) and the terra symbol (⊕)
 * would be mangled by toUpperCase() - α becomes Α (Greek capital alpha),
 * which is not a valid TKA character.
 */
const PRESERVE_CHARS = new Set(["α", "β", "γ", "ζ", "η", "τ", "⊕"]);

/**
 * Uppercase Latin characters while preserving lowercase Greek and special symbols.
 * Standard toUpperCase() converts α → Α which breaks TKA - this function
 * processes character-by-character, skipping protected symbols.
 */
export function uppercasePreservingGreek(value: string): string {
  let result = "";
  for (const char of value) {
    result += PRESERVE_CHARS.has(char) ? char : char.toUpperCase();
  }
  return result;
}

/**
 * Insert text at a cursor position and return the new value + cursor position.
 * Used by input handlers to insert Greek symbols at the caret.
 */
export function insertAtCursor(
  currentValue: string,
  insertion: string,
  cursorPosition: number
): { value: string; cursor: number } {
  const before = currentValue.slice(0, cursorPosition);
  const after = currentValue.slice(cursorPosition);
  return {
    value: before + insertion + after,
    cursor: cursorPosition + insertion.length,
  };
}
