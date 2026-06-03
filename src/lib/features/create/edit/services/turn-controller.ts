import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

const turnValues = [0, 0.5, 1, 1.5, 2, 2.5, 3];

export function getTurnValues(): number[] {
  return [...turnValues];
}

export function canDecrementTurn(
  turnValue: number | "fl" | undefined,
  motionType?: string
): boolean {
  // Float motions cannot be decremented further
  if (turnValue === "fl") return false;
  if (typeof turnValue !== "number") return false;

  // At 0 turns: can decrement if motion is pro/anti (will convert to float)
  if (turnValue === 0) {
    const normalizedMotionType = motionType?.toLowerCase();
    return normalizedMotionType === "pro" || normalizedMotionType === "anti";
  }

  // For non-zero values, can decrement if not at minimum
  return turnValues.indexOf(turnValue) > 0;
}

export function canIncrementTurn(turnValue: number | "fl" | undefined): boolean {
  // Float can be incremented back to 0
  if (turnValue === "fl") return true;
  if (typeof turnValue !== "number") return false;
  return turnValues.indexOf(turnValue) < turnValues.length - 1;
}

export function incrementTurn(currentValue: number | "fl" | undefined): number | "fl" {
  // Float increments to 0
  if (currentValue === "fl") return 0;
  if (typeof currentValue !== "number") return 0;

  const currentIndex = turnValues.indexOf(currentValue);
  if (currentIndex < turnValues.length - 1) {
    return turnValues[currentIndex + 1] ?? currentValue;
  }
  return currentValue;
}

export function decrementTurn(
  currentValue: number | "fl" | undefined,
  motionType?: string
): number | "fl" {
  // Float cannot be decremented further
  if (currentValue === "fl") return "fl";
  if (typeof currentValue !== "number") return 0;

  // At 0 turns with pro/anti motion: convert to float
  if (currentValue === 0) {
    const normalizedMotionType = motionType?.toLowerCase();
    if (normalizedMotionType === "pro" || normalizedMotionType === "anti") {
      return "fl";
    }
    // For other motion types, can't decrement from 0
    return 0;
  }

  // For non-zero values, decrement normally
  const currentIndex = turnValues.indexOf(currentValue);
  if (currentIndex > 0) {
    return turnValues[currentIndex - 1] ?? currentValue;
  }
  return currentValue;
}

export function getTurnValue(turns: number | "fl" | undefined): string {
  if (turns === undefined || turns === null) return "0";
  return turns.toString();
}

export function getTurnDescription(turns: number | "fl" | undefined): string {
  if (turns === undefined || turns === null || turns === 0) return "No turn";
  if (turns === "fl") return "Float";
  if (typeof turns === "number") {
    return turns > 0 ? "Clockwise" : "Counter-clockwise";
  }
  return "Unknown";
}

export function getCurrentTurnValue(
  stepData: StepData | null,
  color: "blue" | "red"
): number | "fl" {
  if (!stepData) return 0;
  const turnValue =
    color === "blue"
      ? stepData.motions.blue?.turns
      : stepData.motions.red?.turns;
  if (turnValue === "fl") return "fl";
  return typeof turnValue === "number" ? turnValue : 0;
}

export function formatTurnDisplay(turnAmount: number | "fl"): string {
  if (turnAmount === "fl") return "fl";
  if (turnAmount === 0) return "0";
  return turnAmount > 0 ? `+${turnAmount}` : `${turnAmount}`;
}
