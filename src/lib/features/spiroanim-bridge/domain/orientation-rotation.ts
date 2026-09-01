/**
 * Orientation translation between SpiroAnim's pattern-rotation axis and the
 * transcribed TKA positions.
 *
 * The transcription (`tka-transcription.json`, captured 2026-08-09) was
 * generated when SpiroAnim's default pattern orientation was a universal -90.
 * SpiroAnim has since moved to a per-ratio default that is 0 for every bridged
 * ratio (1:1, 1:3, 1:5 — vtg and qtr alike), so the raw transcription renders
 * every cell 90° rotated from what a SpiroAnim user sees on a default tile
 * click. Verified against his own compiler on 2026-08-30: compiling cells at
 * orientation -90 reproduces the transcription's position vocabulary exactly,
 * and each +45° of orientation moves every hand one compass step clockwise
 * (n → ne → e → …). Both apps label the compass from the same screen frame —
 * the transcription's grid points came from the same `closestPoint` mapping —
 * so that clockwise convention carries over verbatim.
 *
 * Translation: rotate every transcribed position clockwise by
 * `(requested − (−90)) / 45` compass steps, where a key without an `o` token
 * requests SpiroAnim's default view (0). 8stp has no orientation axis and is
 * never rotated. The rotation itself goes through the canonical
 * position ↔ hand-location owner (`grid-position-deriver`), so a 45° step that
 * lands on intercardinal points produces the real box-grid position names.
 */

import {
  type ParsedCellKey,
  type SpiroAnimOrientation,
} from "./cell-key";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  getGridLocationsFromPosition,
  getGridPositionFromLocations,
} from "$lib/shared/pictograph/grid/services/grid-position-deriver";

/** The orientation the whole transcription corpus was captured at. */
export const TRANSCRIPTION_BASELINE_ORIENTATION: SpiroAnimOrientation = -90;

/** What SpiroAnim shows for every bridged ratio when nothing is selected. */
export const DEFAULT_SPIROANIM_ORIENTATION: SpiroAnimOrientation = 0;

const CLOCKWISE: readonly GridLocation[] = [
  GridLocation.NORTH,
  GridLocation.NORTHEAST,
  GridLocation.EAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTH,
  GridLocation.SOUTHWEST,
  GridLocation.WEST,
  GridLocation.NORTHWEST,
];

/** The orientation a parsed key asks the Composer to render. */
export function effectiveOrientation(key: ParsedCellKey): SpiroAnimOrientation {
  if (key.concept === "8stp") return TRANSCRIPTION_BASELINE_ORIENTATION;
  return key.orientation ?? DEFAULT_SPIROANIM_ORIENTATION;
}

/** Clockwise 45° compass steps between the transcription and the request. */
export function rotationStepsFor(key: ParsedCellKey): number {
  const delta = effectiveOrientation(key) - TRANSCRIPTION_BASELINE_ORIENTATION;
  return (((delta / 45) % 8) + 8) % 8;
}

function rotateLocation(location: GridLocation, steps: number): GridLocation | null {
  const index = CLOCKWISE.indexOf(location);
  if (index === -1) return null;
  return CLOCKWISE[(index + steps) % 8] ?? null;
}

/**
 * Rotate one transcribed position name clockwise by `steps` × 45°. Returns
 * null for a name the deriver does not know or a hand off the compass —
 * upstream treats that as an unresolvable key, never a guess.
 */
export function rotatePositionName(position: string, steps: number): string | null {
  if (steps === 0) return position;
  let left: GridLocation;
  let right: GridLocation;
  try {
    [left, right] = getGridLocationsFromPosition(position as GridPosition);
  } catch {
    return null;
  }
  const rotatedLeft = rotateLocation(left, steps);
  const rotatedRight = rotateLocation(right, steps);
  if (!rotatedLeft || !rotatedRight) return null;
  try {
    return getGridPositionFromLocations(rotatedLeft, rotatedRight);
  } catch {
    return null;
  }
}
