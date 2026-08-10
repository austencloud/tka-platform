import { GridMode } from "../domain/enums/grid-enums";
import type { GridLocation } from "../domain/enums/grid-enums";
import type { PlacementGridPoint } from "./placement-grid-points";
import { getPlacementGridPoints } from "./placement-grid-points";
import type { PropType } from "../../prop/domain/enums/prop-type";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "../../shared/domain/enums/pictograph-enums";
import type { PictographData } from "../../shared/domain/models/pictograph-data";
import { createMotionData } from "../../shared/domain/models/motion-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  calculateBetaOffset,
  type BetaMotionInput,
} from "$lib/shared/render/core/calculations/beta-offset";

export interface PlacementPromptParts {
  lead: string;
  noun: string;
  color: MotionColor;
  aim: string | null;
}

interface PlacementPromptInput {
  disabled: boolean;
  isComplete: boolean;
  canAim: boolean;
  activeColor: MotionColor | null;
  dragColor: MotionColor | null;
  dragAim: Orientation | null;
  hoverColor: MotionColor | null;
  blueLocation: GridLocation | null;
  redLocation: GridLocation | null;
  blueNoun: string;
  redNoun: string;
}

const AIM_LABELS: Partial<Record<Orientation, string>> = {
  [Orientation.IN]: "In",
  [Orientation.OUT]: "Out",
  [Orientation.CLOCK]: "Clock",
  [Orientation.COUNTER]: "Counter",
  [Orientation.CENTER_N]: "North",
  [Orientation.CENTER_NE]: "Northeast",
  [Orientation.CENTER_E]: "East",
  [Orientation.CENTER_SE]: "Southeast",
  [Orientation.CENTER_S]: "South",
  [Orientation.CENTER_SW]: "Southwest",
  [Orientation.CENTER_W]: "West",
  [Orientation.CENTER_NW]: "Northwest",
};

export function buildPlacementPrompt(input: PlacementPromptInput): {
  parts: PlacementPromptParts | null;
  text: string;
} {
  const build = (
    noun: string,
    color: MotionColor,
    lead: string,
    aim: string | null = null
  ): PlacementPromptParts => ({ lead, noun, color, aim });

  let parts: PlacementPromptParts | null = null;

  if (!input.disabled) {
    if (input.dragColor !== null && input.dragAim !== null) {
      const noun =
        input.dragColor === MotionColor.BLUE ? input.blueNoun : input.redNoun;
      parts = build(
        noun,
        input.dragColor,
        "Aiming the",
        AIM_LABELS[input.dragAim] ?? null
      );
    } else if (input.activeColor === null && input.hoverColor !== null) {
      const noun =
        input.hoverColor === MotionColor.BLUE ? input.blueNoun : input.redNoun;
      parts = build(noun, input.hoverColor, "Drag to aim the");
    } else if (input.activeColor === MotionColor.BLUE) {
      parts = build(
        input.blueNoun,
        MotionColor.BLUE,
        input.blueLocation !== null
          ? "Choose a new location for the"
          : input.canAim
            ? "Press a point and drag to aim the"
            : "Place the"
      );
    } else if (input.activeColor === MotionColor.RED) {
      parts = build(
        input.redNoun,
        MotionColor.RED,
        input.redLocation !== null
          ? "Choose a new location for the"
          : input.canAim
            ? "Press a point and drag to aim the"
            : "Place the"
      );
    }
  }

  const text = parts
    ? `${parts.lead} ${parts.noun}${parts.aim ? `: ${parts.aim}` : ""}`
    : !input.disabled && input.isComplete
      ? input.canAim
        ? "Drag a prop to aim it"
        : "Position ready"
      : "";

  return { parts, text };
}

interface PlacementPictographInput {
  gridMode: GridMode;
  blueLocation: GridLocation | null;
  redLocation: GridLocation | null;
  blueOrientation: Orientation;
  redOrientation: Orientation;
  bluePropType: PropType;
  redPropType: PropType;
  betaSwapped: boolean;
  previewPictographData: StepData | PictographData | null;
}

function buildMotion(
  location: GridLocation,
  color: MotionColor,
  orientation: Orientation,
  propType: PropType,
  gridMode: GridMode
) {
  return createMotionData({
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    startLocation: location,
    endLocation: location,
    turns: 0,
    startOrientation: orientation,
    endOrientation: orientation,
    isVisible: true,
    propType,
    arrowLocation: location,
    color,
    gridMode,
  });
}

export function buildPlacementPictographData(
  input: PlacementPictographInput
): PictographData {
  const motions: PictographData["motions"] = {};

  if (input.blueLocation) {
    motions[MotionColor.BLUE] = buildMotion(
      input.blueLocation,
      MotionColor.BLUE,
      input.blueOrientation,
      input.bluePropType,
      input.gridMode
    );
  }
  if (input.redLocation) {
    motions[MotionColor.RED] = buildMotion(
      input.redLocation,
      MotionColor.RED,
      input.redOrientation,
      input.redPropType,
      input.gridMode
    );
  }

  return {
    ...(input.previewPictographData ?? {}),
    id: input.previewPictographData?.id ?? "shared-prop-placement-grid",
    letter: input.previewPictographData?.letter ?? null,
    startPosition: input.previewPictographData?.startPosition ?? null,
    endPosition: input.previewPictographData?.endPosition ?? null,
    gridMode: input.gridMode,
    betaSwapped: input.betaSwapped,
    motions,
  } satisfies PictographData;
}

interface PlacementBetaOffsetInput {
  gridMode: GridMode;
  blueLocation: GridLocation | null;
  redLocation: GridLocation | null;
  blueOrientation: Orientation;
  redOrientation: Orientation;
  bluePropType: PropType;
  redPropType: PropType;
  betaSwapped: boolean;
}

export interface PlacementBetaOffsets {
  blue: { x: number; y: number };
  red: { x: number; y: number };
}

function betaMotionFor(
  color: "blue" | "red",
  location: GridLocation,
  orientation: Orientation,
  propType: PropType
): BetaMotionInput {
  return {
    startLocation: location,
    endLocation: location,
    endOrientation: orientation,
    motionType: MotionType.STATIC,
    color,
    propType,
  };
}

export function calculatePlacementBetaOffsets(
  input: PlacementBetaOffsetInput
): PlacementBetaOffsets {
  if (
    input.blueLocation === null ||
    input.redLocation === null ||
    input.blueLocation !== input.redLocation
  ) {
    return { blue: { x: 0, y: 0 }, red: { x: 0, y: 0 } };
  }

  const blueMotion = betaMotionFor(
    "blue",
    input.blueLocation,
    input.blueOrientation,
    input.bluePropType
  );
  const redMotion = betaMotionFor(
    "red",
    input.redLocation,
    input.redOrientation,
    input.redPropType
  );
  const betaInput = {
    blueMotion,
    redMotion,
    letter: "",
    gridMode: input.gridMode as unknown as "diamond" | "box" | "skewed",
    bluePropType: input.bluePropType,
    redPropType: input.redPropType,
  };
  const sign = input.betaSwapped ? -1 : 1;
  const blue = calculateBetaOffset(betaInput, blueMotion);
  const red = calculateBetaOffset(betaInput, redMotion);

  return {
    blue: { x: blue.x * sign, y: blue.y * sign },
    red: { x: red.x * sign, y: red.y * sign },
  };
}

export interface PlacementGuideCoordinates {
  blue: PlacementGridPoint;
  red: PlacementGridPoint;
}

export function getPlacementGuideCoordinates(
  locations: {
    blue: GridLocation;
    red: GridLocation;
  } | null
): PlacementGuideCoordinates | null {
  if (!locations) return null;

  const allGuidePoints = [
    ...getPlacementGridPoints(GridMode.DIAMOND),
    ...getPlacementGridPoints(GridMode.BOX),
  ];
  const blue = allGuidePoints.find(
    (point) => point.location === locations.blue
  );
  const red = allGuidePoints.find((point) => point.location === locations.red);
  return blue && red ? { blue, red } : null;
}

export function computeGammaGuideArc(
  coordinates: PlacementGuideCoordinates | null
): string {
  if (!coordinates) return "";

  const centerX = 475;
  const centerY = 475;
  const radius = 60;
  const blueAngle = Math.atan2(
    coordinates.blue.y - centerY,
    coordinates.blue.x - centerX
  );
  const redAngle = Math.atan2(
    coordinates.red.y - centerY,
    coordinates.red.x - centerX
  );
  const startX = centerX + radius * Math.cos(blueAngle);
  const startY = centerY + radius * Math.sin(blueAngle);
  const endX = centerX + radius * Math.cos(redAngle);
  const endY = centerY + radius * Math.sin(redAngle);
  let difference = redAngle - blueAngle;

  if (difference < -Math.PI) difference += 2 * Math.PI;
  if (difference > Math.PI) difference -= 2 * Math.PI;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 0 ${difference > 0 ? 1 : 0} ${endX} ${endY}`;
}
