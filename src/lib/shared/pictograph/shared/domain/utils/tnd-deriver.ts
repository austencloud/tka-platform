/**
 * TnD Downbeat Deriver
 *
 * Computes Timing and Direction (and its elemental type) as a PURE GEOMETRIC
 * function of the two hands' arc paths. No letter, no grid mode, no lookup table —
 * so it classifies any pictograph, in either grid, including both halves of gamma
 * and any future start position.
 *
 * The model: TnD is read at the south beat (the downbeat). Each hand's ARC path
 * (start → end grid location) defines its orbital rotation sense. Most pictographs
 * never touch south, so we extrapolate — assume each hand keeps orbiting its way
 * and measure the angular distance from its current (start) location to south,
 * along its orbital direction. The phase difference between the two hands gives
 * timing; the relative orbital sense gives direction.
 *
 * Direction is the HAND ORBITAL arc sense (start→end), NOT the prop spin
 * (rotationDirection). A/B/C share the same hand paths and are all split-same
 * despite different prop rotations — the canonical dataframes prove this. The prop
 * `rotationDirection` field is not consulted.
 *
 * Source of truth for TnD classification (the lookup tables in tnd-calculator.ts
 * are retired to a generated golden-snapshot regression fixture).
 *
 * Design: docs/superpowers/specs/2026-05-30-tnd-downbeat-deriver-and-gamma-split-design.md
 */

import { TnDMode, MotionColor } from "../enums/pictograph-enums";
import type { GridLocation } from "../../../grid/domain/enums/grid-enums";
import type { PictographData } from "../models/PictographData";
import { deriveHandOrbitalDirection } from "../../../../render/core/calculations/orientation";
import { TND_TO_ELEMENTAL, type TnDCalculationResult } from "./tnd-calculator";

/** Compass angle of each grid location, degrees clockwise from north. */
const ANG: Readonly<Record<string, number>> = {
  n: 0,
  ne: 45,
  e: 90,
  se: 135,
  s: 180,
  sw: 225,
  w: 270,
  nw: 315,
};

const SOUTH = 180;

const NULL_RESULT: TnDCalculationResult = { tndMode: null, elementalType: null };

/**
 * Degrees of travel from `loc` to south along orbital direction `dir`.
 * CW measures forward (increasing compass angle), CCW measures backward.
 */
function phaseToSouth(loc: GridLocation, dir: "cw" | "ccw"): number {
  const a = ANG[loc];
  if (a === undefined) return Number.NaN;
  return dir === "cw"
    ? (((SOUTH - a) % 360) + 360) % 360
    : (((a - SOUTH) % 360) + 360) % 360;
}

/** (timing, direction) → TnD mode. */
const MODE_BY_TIMING_DIR: Readonly<Record<string, TnDMode>> = {
  "tog-same": TnDMode.TOG_SAME,
  "tog-opp": TnDMode.TOG_OPP,
  "split-same": TnDMode.SPLIT_SAME,
  "split-opp": TnDMode.SPLIT_OPP,
  "quarter-same": TnDMode.QUARTER_SAME,
  "quarter-opp": TnDMode.QUARTER_OPP,
};

/**
 * Derive TnD mode + elemental type from the two hands' arc geometry.
 *
 * @param blueStart blue hand's start grid location
 * @param blueEnd   blue hand's end grid location
 * @param redStart  red hand's start grid location
 * @param redEnd    red hand's end grid location
 * @returns the classified TnD result, or nulls when either hand is not a rotating
 *   shift (its arc has no orbital sense — static or dash geometry)
 */
export function deriveTnD(
  blueStart: GridLocation,
  blueEnd: GridLocation,
  redStart: GridLocation,
  redEnd: GridLocation
): TnDCalculationResult {
  const blueDir = deriveHandOrbitalDirection(blueStart, blueEnd);
  const redDir = deriveHandOrbitalDirection(redStart, redEnd);
  if (blueDir === null || redDir === null) return NULL_RESULT;

  const bluePhase = phaseToSouth(blueStart, blueDir);
  const redPhase = phaseToSouth(redStart, redDir);
  if (Number.isNaN(bluePhase) || Number.isNaN(redPhase)) return NULL_RESULT;

  const delta = (((bluePhase - redPhase) % 360) + 360) % 360;
  const timing = delta === 0 ? "tog" : delta === 180 ? "split" : "quarter";
  const direction = blueDir === redDir ? "same" : "opp";

  const tndMode = MODE_BY_TIMING_DIR[`${timing}-${direction}`]!;
  return { tndMode, elementalType: TND_TO_ELEMENTAL[tndMode] };
}

/**
 * Derive TnD from a pictograph by reading its blue/red motion arcs.
 * Each hand's arc is the motion's start → end location. Classification is purely
 * geometric: only shift arcs (pro/anti/float — adjacent points) carry an orbital
 * sense, so static start positions and dash/hash legs naturally yield nulls.
 */
export function deriveTnDFromPictograph(
  p: PictographData | null | undefined
): TnDCalculationResult {
  const blue = p?.motions?.[MotionColor.BLUE];
  const red = p?.motions?.[MotionColor.RED];
  if (!blue || !red) return NULL_RESULT;

  return deriveTnD(
    blue.startLocation,
    blue.endLocation,
    red.startLocation,
    red.endLocation
  );
}
