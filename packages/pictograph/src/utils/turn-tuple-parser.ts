/**
 * Turn Tuple Parser
 *
 * Parses turns tuple strings into structured data.
 * Handles format: "(direction, top, bottom)" or "(top, bottom)"
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

export function parseTurnsTuple(turnsTuple: string): ParsedTurnsTuple {
  if (!turnsTuple.trim()) {
    return { direction: null, top: 0, bottom: 0 };
  }

  try {
    const cleaned = turnsTuple.replace(/[()]/g, "").trim();
    const parts = cleaned.split(",").map((p) => p.trim());

    if (parts.length < 2) {
      return { direction: null, top: 0, bottom: 0 };
    }

    const firstIsDirection = VALID_DIRECTIONS.includes(
      parts[0] as (typeof VALID_DIRECTIONS)[number]
    );

    if (firstIsDirection && parts.length >= 3) {
      return {
        direction: parts[0] as DirectionValue,
        top: parseTurnValue(parts[1] || ""),
        bottom: parseTurnValue(parts[2] || ""),
      };
    } else {
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

function parseTurnValue(value: string): TurnValue {
  if (!value) return 0;
  if (value === "fl") return "fl";

  const num = parseFloat(value);
  if (isNaN(num)) return 0;

  if (VALID_TURN_NUMBERS.includes(num as (typeof VALID_TURN_NUMBERS)[number])) {
    return num;
  }

  return 0;
}

export function shouldDisplayTurn(value: TurnValue): boolean {
  if (value === "fl") return true;
  return typeof value === "number" && value !== 0;
}

export function getTurnNumberImagePath(value: TurnValue): string {
  if (value === "fl") {
    return "/images/numbers/float.svg";
  }

  if (typeof value === "number" && value !== 0) {
    return `/images/numbers/${value}.svg`;
  }

  return "";
}

export function getTurnNumberWidth(value: TurnValue): number {
  if (value === "fl") {
    return 42.4;
  }

  if (typeof value === "number") {
    if (value === 0.5 || value === 1.5) {
      return 80;
    }
    if (value === 2.5) {
      return 83.67;
    }
    return 30;
  }

  return 0;
}
