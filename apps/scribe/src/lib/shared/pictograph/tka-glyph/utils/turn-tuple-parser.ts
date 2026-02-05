/**
 * Turn Tuple Parser
 *
 * Parses turns tuple strings into structured data.
 * Handles format: "(direction, top, bottom)" or "(top, bottom)"
 *
 * Examples:
 * - "(s, 1, 2)" => { direction: "s", top: 1, bottom: 2 }
 * - "(1.5, fl)" => { direction: null, top: 1.5, bottom: "fl" }
 * - "(cw, 0, 1)" => { direction: "cw", top: 0, bottom: 1 }
 */

export type TurnValue = number | "fl";
export type DirectionValue = "s" | "o" | "cw" | "ccw" | null;

export interface ParsedTurnsTuple {
  direction: DirectionValue;
  top: TurnValue;
  bottom: TurnValue;
}

const VALID_DIRECTIONS = ["s", "o", "cw", "ccw"] as const;
const VALID_TURN_NUMBERS = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;

/**
 * Parse a turns tuple string into structured data
 */
export function parseTurnsTuple(turnsTuple: string): ParsedTurnsTuple {
  if (!turnsTuple.trim()) {
    return { direction: null, top: 0, bottom: 0 };
  }

  try {
    // Remove parentheses and whitespace, split by comma
    const cleaned = turnsTuple.replace(/[()]/g, "").trim();
    const parts = cleaned.split(",").map((p) => p.trim());

    if (parts.length < 2) {
      return { direction: null, top: 0, bottom: 0 };
    }

    // Check if first part is a direction (3-part tuple) or a turn value (2-part tuple)
    const firstIsDirection = VALID_DIRECTIONS.includes(
      parts[0] as (typeof VALID_DIRECTIONS)[number]
    );

    if (firstIsDirection && parts.length >= 3) {
      // Format: (direction, top, bottom)
      return {
        direction: parts[0] as DirectionValue,
        top: parseTurnValue(parts[1] || ""),
        bottom: parseTurnValue(parts[2] || ""),
      };
    } else {
      // Format: (top, bottom)
      return {
        direction: null,
        top: parseTurnValue(parts[0] || ""),
        bottom: parseTurnValue(parts[1] || ""),
      };
    }
  } catch (error) {
    console.error("Failed to parse turns tuple:", turnsTuple, error);
    return { direction: null, top: 0, bottom: 0 };
  }
}

/**
 * Parse a single turn value string into a number or "fl"
 */
function parseTurnValue(value: string): TurnValue {
  if (!value) return 0;
  if (value === "fl") return "fl";

  const num = parseFloat(value);
  if (isNaN(num)) return 0;

  // Validate it's a valid turn number
  if (VALID_TURN_NUMBERS.includes(num as (typeof VALID_TURN_NUMBERS)[number])) {
    return num;
  }

  return 0;
}

/**
 * Check if a turn value should be displayed (non-zero)
 */
export function shouldDisplayTurn(value: TurnValue): boolean {
  if (value === "fl") return true;
  return typeof value === "number" && value !== 0;
}

/**
 * Get the file path for a turn number SVG
 * Note: static/ directory maps to / in SvelteKit
 */
export function getTurnNumberImagePath(value: TurnValue): string {
  if (value === "fl") {
    return "/images/numbers/float.svg";
  }

  if (typeof value === "number" && value !== 0) {
    return `/images/numbers/${value}.svg`;
  }

  return "";
}

/**
 * Get the actual width of a turn number SVG based on its viewBox
 * These values are extracted from the actual SVG files in static/images/numbers/
 *
 * ViewBox dimensions:
 * - 1, 2, 3: viewBox="0 0 30 45" (single digits)
 * - float: viewBox="0 0 42.4 45"
 * - 0.5, 1.5: viewBox="0 0 80 45" (decimal numbers)
 * - 2.5: viewBox="0 0 83.67 45" (widest decimal)
 */
export function getTurnNumberWidth(value: TurnValue): number {
  if (value === "fl") {
    return 42.4;
  }

  if (typeof value === "number") {
    // Decimal numbers (0.5, 1.5, 2.5) are wider
    if (value === 0.5 || value === 1.5) {
      return 80;
    }
    if (value === 2.5) {
      return 83.67;
    }
    // Single digits (1, 2, 3) are narrow
    return 30;
  }

  return 0;
}
