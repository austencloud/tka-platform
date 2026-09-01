export interface PictographCsvMotion {
  motionType: string;
  startLocation: string;
  endLocation: string;
  rotationDirection: string;
}

/**
 * The published pictograph CSV is a stable blue/red interchange format. The
 * MCP converts that wire vocabulary to left/right at this single boundary.
 */
export function readPictographCsvMotion(
  row: Record<string, string>,
  hand: "left" | "right"
): PictographCsvMotion {
  const prefix = hand === "left" ? "blue" : "red";
  return {
    motionType: row[`${prefix}MotionType`] ?? "",
    startLocation: row[`${prefix}StartLocation`] ?? "",
    endLocation: row[`${prefix}EndLocation`] ?? "",
    rotationDirection: row[`${prefix}RotationDirection`] || "cw",
  };
}
