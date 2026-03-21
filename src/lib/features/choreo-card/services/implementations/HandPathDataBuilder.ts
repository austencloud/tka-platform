/**
 * Hand Path Data Builder
 *
 * Converts a hand-path ID string (e.g. "n→e→e→s|s→w→w→n") into an array
 * of PictographData beats for rendering hand movement over time.
 *
 * Hand path data is fundamentally simple: two hands, each at a grid location,
 * transitioning to new locations over 8 beats. No props, no rotation, no turns,
 * no orientation. Just spatial movement.
 *
 * The builder produces the absolute minimum data needed:
 *   - color (blue/red)
 *   - start and end location
 *   - handPath direction (CW, CCW, DASH, or STATIC — derived from locations)
 *
 * Everything the render pipeline needs beyond that (motionType, turns, propType)
 * is derived from these core fields at creation time via createMotionData defaults.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  MotionColor,
  HandPath,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type {
  IHandPathDataBuilder,
  HandPathTrace,
  HandSkew,
} from "../contracts/IHandPathDataBuilder";

// ============================================================================
// DIRECTION LOOKUP
// ============================================================================

// The 8 compass points in clockwise order. Any step from point[i] to point[i+1]
// (mod 8) is clockwise. The reverse is counter-clockwise.
const CLOCKWISE_ORDER: GridLocation[] = [
  GridLocation.NORTH,
  GridLocation.NORTHEAST,
  GridLocation.EAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTH,
  GridLocation.SOUTHWEST,
  GridLocation.WEST,
  GridLocation.NORTHWEST,
];

// String-value → GridLocation enum lookup (covers both cardinal and intercardinal)
const LOCATION_BY_VALUE: Record<string, GridLocation> = Object.fromEntries(
  Object.values(GridLocation).map((v) => [v, v as GridLocation])
) as Record<string, GridLocation>;

// ============================================================================
// HAND PATH DATA BUILDER
// ============================================================================

export class HandPathDataBuilder implements IHandPathDataBuilder {
  /**
   * Parses a hand-path ID into blue and red GridLocation arrays.
   *
   * Format: "n→e→e→s→s→w→w→n→n|s→w→w→n→n→e→e→s→s"
   * The "→" separator is a Unicode right arrow (U+2192), not "->".
   */
  parseHandPathId(handPathId: string): HandPathTrace {
    const [bluePart, redPart] = handPathId.split("|");

    if (!bluePart || !redPart) {
      throw new Error(
        `Invalid hand path ID — expected "blue|red" format: "${handPathId}"`
      );
    }

    return {
      blue: this.parseLocationSequence(bluePart, "blue"),
      red: this.parseLocationSequence(redPart, "red"),
    };
  }

  /**
   * Builds PictographData beats from a location trace.
   *
   * Beat N covers the transition from trace[N] to trace[N+1].
   * Each motion carries only what matters for hand paths: locations and
   * the derived hand path direction. The render pipeline fields (motionType,
   * turns, propType) are set to match the hand path semantics:
   *   - moved → FLOAT + "fl" turns (shows trajectory arrow)
   *   - stayed → STATIC + 0 turns (no arrow)
   *   - propType always HAND
   */
  buildFromTrace(trace: HandPathTrace): PictographData[] {
    const blueLen = trace.blue.length;
    const redLen = trace.red.length;

    if (blueLen < 2 || redLen < 2) {
      throw new Error(
        `Hand path trace must have at least 2 locations per hand (blue: ${blueLen}, red: ${redLen})`
      );
    }

    const beatCount = Math.min(blueLen, redLen) - 1;
    const hash = this.hashTrace(trace);
    const beats: PictographData[] = [];

    for (let i = 0; i < beatCount; i++) {
      const blueStart = trace.blue[i]!;
      const blueEnd = trace.blue[i + 1]!;
      const redStart = trace.red[i]!;
      const redEnd = trace.red[i + 1]!;

      const blueHandPath = this.deriveHandPath(blueStart, blueEnd);
      const redHandPath = this.deriveHandPath(redStart, redEnd);
      const beatSkews = trace.skews?.[i];

      beats.push({
        id: `hp-${hash}-beat-${i + 1}`,
        letter: null,
        gridMode: GridMode.DIAMOND,
        motions: {
          [MotionColor.BLUE]: this.createHandMotion(
            MotionColor.BLUE, blueStart, blueEnd, blueHandPath, beatSkews?.blue
          ),
          [MotionColor.RED]: this.createHandMotion(
            MotionColor.RED, redStart, redEnd, redHandPath, beatSkews?.red
          ),
        },
      });
    }

    return beats;
  }

  /**
   * Parse the ID then build beats. When a representative sequence is provided,
   * its first beat is used to correct color assignment (the ID is sorted
   * alphabetically for dedup, which may swap blue/red).
   */
  buildFromHandPathId(handPathId: string, representative?: SequenceData): PictographData[] {
    const trace = this.parseHandPathId(handPathId);

    if (representative?.steps?.length) {
      this.correctColorAssignment(trace, representative);
    }

    return this.buildFromTrace(trace);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Creates a single hand motion from the core hand path data.
   *
   * This is the boundary where hand path concepts (location + direction)
   * meet the render pipeline's MotionType vocabulary. The mapping follows
   * the HandMotionType → MotionType equivalence:
   *
   *   HandMotionType  | HandPath          | → MotionType | → turns
   *   SHIFT           | CW or CCW         | FLOAT        | "fl"
   *   DASH            | DASH              | DASH         | 0
   *   HASH_IN         | HASH_IN           | DASH         | 0
   *   HASH_OUT        | HASH_OUT          | DASH         | 0
   *   STATIC          | STATIC            | STATIC       | 0
   */
  private createHandMotion(
    color: MotionColor,
    start: GridLocation,
    end: GridLocation,
    handPath: HandPath,
    skew?: HandSkew,
  ) {
    const isShift = handPath === HandPath.CLOCKWISE || handPath === HandPath.COUNTER_CLOCKWISE;
    const isDash = handPath === HandPath.DASH
      || handPath === HandPath.HASH_IN
      || handPath === HandPath.HASH_OUT;

    return createMotionData({
      color,
      propType: PropType.HAND,
      startLocation: start,
      endLocation: end,
      motionType: isShift ? MotionType.FLOAT : isDash ? MotionType.DASH : MotionType.STATIC,
      turns: isShift ? "fl" : 0,
      handPath,
      // Skew: how far the shift deviates from the normal arc
      // (shift+ = further, shift- = shorter). Only meaningful for shifts.
      skewSteps: skew?.steps ?? null,
      skewDir: skew?.direction ?? null,
    });
  }

  /**
   * The hand path ID is sorted alphabetically for dedup (so blue↔red swaps
   * produce the same key). This means parseHandPathId may assign the traces
   * to the wrong colors. We fix that here by comparing the first trace
   * location against the representative sequence's actual blue start location.
   * If they don't match, swap the traces.
   */
  private correctColorAssignment(
    trace: HandPathTrace,
    representative: SequenceData
  ): void {
    const firstBeat = representative.steps.find(
      (s) => "stepNumber" in s && (s as { stepNumber: number }).stepNumber >= 1
    );
    if (!firstBeat) return;

    const blueMotion = firstBeat.motions?.[MotionColor.BLUE];
    if (!blueMotion?.startLocation) return;

    const actualBlueStart = blueMotion.startLocation.toLowerCase();
    const traceBlueStart = trace.blue[0];

    if (traceBlueStart && traceBlueStart !== actualBlueStart) {
      const temp = trace.blue;
      trace.blue = trace.red;
      trace.red = temp;
    }
  }

  private parseLocationSequence(
    part: string,
    label: string
  ): GridLocation[] {
    return part.split("→").map((raw, idx) => {
      const trimmed = raw.trim().toLowerCase();
      const loc = LOCATION_BY_VALUE[trimmed];
      if (!loc) {
        throw new Error(
          `Unknown grid location "${trimmed}" at index ${idx} in ${label} path`
        );
      }
      return loc;
    });
  }

  /**
   * Derives the hand path direction from two grid locations.
   *
   * Uses the canonical 8-point clockwise ring
   * (N → NE → E → SE → S → SW → W → NW → N).
   *
   *   - Same location → STATIC
   *   - To center → HASH_IN (perimeter → center)
   *   - From center → HASH_OUT (center → perimeter)
   *   - Opposite on ring (4 steps) → DASH (straight across)
   *   - Other ring movement → CW or CCW (shorter arc wins)
   */
  private deriveHandPath(
    start: GridLocation,
    end: GridLocation
  ): HandPath {
    if (start === end) return HandPath.STATIC;

    // Center involvement = hash movement
    if (end === GridLocation.CENTER) return HandPath.HASH_IN;
    if (start === GridLocation.CENTER) return HandPath.HASH_OUT;

    const startIdx = CLOCKWISE_ORDER.indexOf(start);
    const endIdx = CLOCKWISE_ORDER.indexOf(end);

    // Safety: if somehow a location isn't on the ring, default to CW
    if (startIdx === -1 || endIdx === -1) return HandPath.CLOCKWISE;

    const len = CLOCKWISE_ORDER.length; // 8
    const cwSteps = ((endIdx - startIdx) + len) % len;

    // Exactly opposite (4 steps in either direction) = straight across = DASH
    if (cwSteps === 4) return HandPath.DASH;

    // Shorter arc wins. Ties default to CW (but 4 is already handled above).
    const ccwSteps = len - cwSteps;
    return cwSteps <= ccwSteps ? HandPath.CLOCKWISE : HandPath.COUNTER_CLOCKWISE;
  }

  /**
   * Produces a short, stable hash string from the trace contents.
   * Used to make beat IDs deterministic and unique per distinct trace.
   *
   * Algorithm: djb2 variant over the joined location strings.
   */
  private hashTrace(trace: HandPathTrace): string {
    const combined =
      trace.blue.join(",") + "|" + trace.red.join(",");

    let hash = 5381;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) + hash) ^ combined.charCodeAt(i);
      hash = hash >>> 0; // keep it 32-bit unsigned
    }
    return hash.toString(16).padStart(8, "0");
  }
}
