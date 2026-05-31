/**
 * StepBoundaryDetector - Find beat transitions in a hand timeline
 *
 * Walks through DetectionFrame[] sequentially, grouping consecutive
 * frames that share the same blue + red grid locations into beats.
 * A new beat begins when either hand changes grid position.
 *
 * Short segments (below minFramesPerBeat) are merged into the
 * previous beat to filter out noise from brief detection glitches.
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { DetectionFrame } from "$lib/shared/train/domain/detection-frame";
import type { HandTimeline, DetectedBeat, StepPosition } from "../domain/models";
import type { StepDetectionOptions } from "./types";

const DEFAULT_MIN_FRAMES_PER_BEAT = 3;
const DEFAULT_MIN_CONFIDENCE = 0.5;

interface FrameGroup {
  frames: DetectionFrame[];
  blueLocation: GridLocation | null;
  redLocation: GridLocation | null;
}

export function detectBeats(
  timeline: HandTimeline,
  options?: StepDetectionOptions
): DetectedBeat[] {
  const minFrames = options?.minFramesPerBeat ?? DEFAULT_MIN_FRAMES_PER_BEAT;
  const minConfidence = options?.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  // Step 1: Group consecutive frames with same positions
  const rawGroups = groupByPosition(timeline.frames, minConfidence);

  // Step 2: Merge short groups into their predecessors
  const mergedGroups = mergeShortGroups(rawGroups, minFrames);

  // Step 3: Convert groups to DetectedBeat[]
  return mergedGroups.map((group, index) =>
    groupToBeat(group, index, minConfidence)
  );
}

/** Group consecutive frames that share the same blue+red grid locations */
function groupByPosition(
  frames: DetectionFrame[],
  minConfidence: number
): FrameGroup[] {
  const groups: FrameGroup[] = [];
  let currentGroup: FrameGroup | null = null;

  for (const frame of frames) {
    const blue = getValidLocation(frame, "blue", minConfidence);
    const red = getValidLocation(frame, "red", minConfidence);

    const samePosition =
      currentGroup != null &&
      blue === currentGroup?.blueLocation &&
      red === currentGroup?.redLocation;

    if (!samePosition) {
      // Start a new group
      currentGroup = {
        frames: [frame],
        blueLocation: blue,
        redLocation: red,
      };
      groups.push(currentGroup);
    } else {
      currentGroup!.frames.push(frame);
    }
  }

  return groups;
}

/** Merge groups shorter than minFrames into the previous group */
function mergeShortGroups(
  groups: FrameGroup[],
  minFrames: number
): FrameGroup[] {
  if (groups.length <= 1) return groups;

  const result: FrameGroup[] = [];

  for (const group of groups) {
    if (group.frames.length < minFrames && result.length > 0) {
      // Merge into the previous group
      const prev = result[result.length - 1];
      if (prev) {
        prev.frames.push(...group.frames);
      }
    } else {
      result.push(group);
    }
  }

  return result;
}

/** Convert a frame group into a DetectedBeat */
function groupToBeat(
  group: FrameGroup,
  index: number,
  minConfidence: number
): DetectedBeat {
  const firstFrame = group.frames[0];
  const lastFrame = group.frames[group.frames.length - 1];
  const startTime = firstFrame?.timestamp ?? 0;
  const endTime = lastFrame?.timestamp ?? startTime;

  const positions: StepPosition[] = [];

  // Compute average confidence for blue hand
  if (group.blueLocation) {
    const blueConfidences = group.frames
      .filter((f) => f.blue && f.blue.confidence >= minConfidence)
      .map((f) => f.blue!.confidence);

    if (blueConfidences.length > 0) {
      const sum = blueConfidences.reduce((a, b) => a + b, 0);
      positions.push({
        hand: "blue",
        location: group.blueLocation,
        confidence: sum / blueConfidences.length,
      });
    }
  }

  // Compute average confidence for red hand
  if (group.redLocation) {
    const redConfidences = group.frames
      .filter((f) => f.red && f.red.confidence >= minConfidence)
      .map((f) => f.red!.confidence);

    if (redConfidences.length > 0) {
      const sum = redConfidences.reduce((a, b) => a + b, 0);
      positions.push({
        hand: "red",
        location: group.redLocation,
        confidence: sum / redConfidences.length,
      });
    }
  }

  return {
    index,
    startTime,
    endTime,
    frameCount: group.frames.length,
    positions,
    positionLabel: derivePositionLabel(group.blueLocation, group.redLocation),
  };
}

/** Get the valid grid location for a hand, or null if below confidence */
function getValidLocation(
  frame: DetectionFrame,
  hand: "blue" | "red",
  minConfidence: number
): GridLocation | null {
  const detected = frame[hand];
  if (!detected || detected.confidence < minConfidence) return null;
  return detected.quadrant;
}

/**
 * Derive a TKA position label from blue+red grid locations.
 *
 * Alpha = opposite points, Beta = same point, Gamma = right angle.
 * Returns null if either hand is undetected.
 */
function derivePositionLabel(
  blue: GridLocation | null,
  red: GridLocation | null
): string | null {
  if (!blue || !red) return null;

  if (blue === red) return "beta";

  // Check if opposite (n/s, e/w, ne/sw, nw/se)
  if (isOpposite(blue, red)) return "alpha";

  // Otherwise gamma (right angle on cardinal grid)
  return "gamma";
}

/** Check if two grid locations are opposite */
function isOpposite(a: GridLocation, b: GridLocation): boolean {
  const opposites: Record<string, string> = {
    n: "s",
    s: "n",
    e: "w",
    w: "e",
    ne: "sw",
    sw: "ne",
    nw: "se",
    se: "nw",
  };
  return opposites[a] === b;
}
