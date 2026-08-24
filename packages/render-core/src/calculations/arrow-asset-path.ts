import type { MotionType, Orientation } from "../types.js";

export interface FullArrowAssetPathInput {
  motionType: MotionType;
  startOrientation?: Orientation;
  turns?: number | "fl";
  skewSteps?: number;
  skewDirection?: "+" | "-";
}

const QUARTER_TURN_MOTION_TYPES = new Set<MotionType>([
  "pro",
  "anti",
  "static",
  "dash",
]);

const ORIENTATION_BY_LOWER: Readonly<Record<string, Orientation>> = {
  in: "in",
  out: "out",
  clock: "clock",
  counter: "counter",
  clockin: "clockIn",
  clockout: "clockOut",
  counterin: "counterIn",
  counterout: "counterOut",
  centern: "centerN",
  centerne: "centerNE",
  centere: "centerE",
  centerse: "centerSE",
  centers: "centerS",
  centersw: "centerSW",
  centerw: "centerW",
  centernw: "centerNW",
};

function normalizeOrientation(
  orientation: Orientation | undefined
): Orientation | undefined {
  return orientation
    ? ORIENTATION_BY_LOWER[orientation.toLowerCase()]
    : undefined;
}

function formatTurns(turns: FullArrowAssetPathInput["turns"]): string {
  if (turns === "fl") return "fl";
  if (typeof turns !== "number") return "0.0";
  return Number.isInteger(turns) ? `${turns}.0` : turns.toString();
}

function resolveOrientationFolder({
  motionType,
  startOrientation,
  turns,
}: FullArrowAssetPathInput): string {
  startOrientation = normalizeOrientation(startOrientation);
  const hasQuarterTurnArt =
    turns === 0.25 && QUARTER_TURN_MOTION_TYPES.has(motionType);

  if (hasQuarterTurnArt) {
    if (startOrientation === "clockIn" || startOrientation === "counterOut") {
      return "from_interradial_clock_in";
    }
    if (startOrientation === "clockOut" || startOrientation === "counterIn") {
      return "from_interradial_clock_out";
    }
    if (motionType === "static" || motionType === "dash") {
      const centerFolder: Partial<Record<Orientation, string>> = {
        centerN: "from_center_n",
        centerNE: "from_center_ne",
        centerE: "from_center_e",
        centerSE: "from_center_se",
        centerS: "from_center_s",
        centerSW: "from_center_sw",
        centerW: "from_center_w",
        centerNW: "from_center_nw",
      };
      if (startOrientation && centerFolder[startOrientation]) {
        return centerFolder[startOrientation]!;
      }
    }
  }

  return startOrientation === "in" || startOrientation === "out"
    ? "from_radial"
    : "from_nonradial";
}

/**
 * Resolve a full-motion arrow beneath the static asset root. Both the browser
 * renderer and the MCP renderer use this path, so Level 6 axis selection
 * cannot drift between interactive and generated pictographs.
 */
export function resolveFullArrowAssetPath(
  input: FullArrowAssetPathInput
): string {
  if (input.motionType === "float" || input.turns === "fl") {
    return "images/arrows/float.svg";
  }

  const orientationFolder = resolveOrientationFolder(input);
  const turns = formatTurns(input.turns);
  const skewSuffix =
    input.turns !== 0.25 &&
    input.skewSteps &&
    input.skewSteps > 0 &&
    input.skewDirection &&
    (input.motionType === "pro" || input.motionType === "anti")
      ? `_skew${input.skewDirection}`
      : "";

  return `images/arrows/${input.motionType}/${orientationFolder}/${input.motionType}_${turns}${skewSuffix}.svg`;
}
