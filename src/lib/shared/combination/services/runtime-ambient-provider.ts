/**
 * The ambient provider that finally connects the combination engine to the
 * real pictograph dataset.
 *
 * The engine asks one question — "what ambient material STARTS at this seam?"
 * — and every test until now answered it with a hand-built stub over the
 * fixtures. This is the production answer: the app's own `motionQueryHandler`,
 * the same service the construct tab's option picker asks what may come next.
 *
 * **Why a probe step.** The handler's real entry point is
 * `getNextOptionsForSequence(sequence, gridMode)`, which takes the
 * sequence-so-far and matches each candidate's START locations against the
 * last step's END locations (see `option-loader.ts` for the app's use of the
 * same call). The engine has no sequence at this point — it has a bare seam,
 * which is precisely the pair of hand locations
 * `getGridLocationsFromPosition` already maps a `GridPosition` to. So a
 * one-step PROBE is built that simply STANDS at the seam (both hands static,
 * start location = end location), and the handler answers with everything that
 * can follow it. That reuses the app's seam matching rather than
 * re-implementing a by-start-position scan over the dataframe.
 *
 * The probe's orientations are IN/IN and are deliberately meaningless: a bare
 * seam carries no orientation history. The handler rewrites each option's start
 * orientation to continue from the probe, and the engine's splice builder
 * re-derives the whole chain's orientations from the assembled sequence's own
 * start anyway (`recalculateAllOrientations`), so nothing downstream trusts the
 * value invented here. Locations and position labels are what matter, and those
 * come from the dataframe untouched.
 *
 * **What gets filtered out, and why it is counted.** Three gates, all of which
 * the engine ALSO applies to whatever a provider hands it (a provider is a
 * collaborator, not an authority):
 *
 *   1. the step must actually start at the seam that was asked about —
 *      `getNextOptionsForSequence` has a documented "no matches, return
 *      everything" fallback, and an unguarded provider would faithfully relay
 *      the entire dataframe as if it belonged at that seam;
 *   2. its letter must belong to a roster-confirmed ambient base
 *      (`ambientLetterSet`) — connective tissue, not a third card;
 *   3. its position labels must agree with its own motion locations
 *      (`positionLabelsMatchLocations`).
 *
 * Gate 3 is the one worth watching. The engine drops mismatched material and
 * warns exactly ONCE per search, so a dataframe that ever started labelling a
 * location pair differently than `getGridPositionFromLocations` does would
 * quietly cost real bridges. `stats` therefore counts every rejection by
 * category, on the provider itself, where it is inspectable from a test or a
 * lab panel instead of scrolling past in a console. Pinned at zero across all
 * 1,152 shipped rows in `facade.test.ts`.
 */

import { ambientLetterSet } from "../domain/base-sequence-registry";
import type { AmbientOptionProvider, SeamState } from "../domain/types";
import { positionLabelsMatchLocations } from "./position-groups";

import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getGridLocationsFromPosition } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";

/** Per-provider rejection tally — see the module comment's gate 3. */
export interface RuntimeAmbientProviderStats {
  /** Distinct seams the engine asked about (cache hits excluded). */
  readonly seamsQueried: number;
  /** Candidates the dataset offered across those seams, before any filtering. */
  readonly optionsOffered: number;
  /** Dropped: the seam has no location pair, or the handler threw. */
  readonly seamsUnresolved: number;
  /** Dropped: did not actually start at the requested seam. */
  readonly seamMismatches: number;
  /** Dropped: letter belongs to no roster-confirmed ambient base. */
  readonly letterRejections: number;
  /** Dropped: position labels disagree with the step's own motion locations. */
  readonly labelMismatches: number;
  /** Handed to the engine. */
  readonly optionsKept: number;
}

export interface RuntimeAmbientProvider extends AmbientOptionProvider {
  readonly stats: RuntimeAmbientProviderStats;
}

type MutableStats = {
  -readonly [K in keyof RuntimeAmbientProviderStats]: number;
};

/**
 * A one-step sequence that simply STANDS at the seam — both hands static at
 * the seam's own locations, so the handler's "what can follow this?" matching
 * resolves to "what can start here?".
 */
function buildSeamProbe(seam: SeamState, gridMode: GridMode): StepData {
  const [blueLocation, redLocation] = getGridLocationsFromPosition(seam);
  const stand = (color: MotionColor, location: GridLocation) =>
    createMotionData({
      color,
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: location,
      endLocation: location,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
    });

  return createStepData({
    letter: null,
    startPosition: seam,
    endPosition: seam,
    gridMode,
    motions: {
      [MotionColor.BLUE]: stand(MotionColor.BLUE, blueLocation),
      [MotionColor.RED]: stand(MotionColor.RED, redLocation),
    },
  });
}

/**
 * Ambient material from the live pictograph dataset, one seam at a time.
 *
 * Results are memoized per seam as PROMISES, not values: the engine expands its
 * ambient pool breadth-first and runs a hop's lookups together, so two
 * concurrent asks for the same seam must share one dataset query rather than
 * race into two.
 */
export function createRuntimeAmbientProvider(
  gridMode: GridMode
): RuntimeAmbientProvider {
  const eligibleLetters = ambientLetterSet();
  const cache = new Map<SeamState, Promise<readonly StepData[]>>();
  const stats: MutableStats = {
    seamsQueried: 0,
    optionsOffered: 0,
    seamsUnresolved: 0,
    seamMismatches: 0,
    letterRejections: 0,
    labelMismatches: 0,
    optionsKept: 0,
  };

  const lookUp = async (seam: SeamState): Promise<readonly StepData[]> => {
    stats.seamsQueried++;

    let probe: StepData;
    try {
      probe = buildSeamProbe(seam, gridMode);
    } catch {
      // The seam names no location pair — nothing can start there.
      stats.seamsUnresolved++;
      return [];
    }

    // A dataset failure is NOT an empty seam, and must not be reported as one:
    // the engine treats a throwing provider as an INCOMPLETE pool and
    // suppresses its impossibility proof, which is exactly right — a smaller
    // graph can only manufacture a false theorem. Swallowing the error here
    // and returning [] would hand the engine a subset graph it believed was
    // the whole one. So it propagates.
    const offered = await motionQueryHandler.getNextOptionsForSequence(
      [probe],
      gridMode
    );

    stats.optionsOffered += offered.length;

    const kept: StepData[] = [];
    for (const option of offered) {
      if (option.startPosition !== seam) {
        stats.seamMismatches++;
        continue;
      }
      if (!option.letter || !eligibleLetters.has(option.letter)) {
        stats.letterRejections++;
        continue;
      }
      if (!option.motions.blue || !option.motions.red) {
        stats.labelMismatches++;
        continue;
      }

      const step = createStepData({ ...option, isBlank: false });
      if (!positionLabelsMatchLocations(step)) {
        stats.labelMismatches++;
        continue;
      }

      kept.push(step);
    }

    stats.optionsKept += kept.length;
    return kept;
  };

  return {
    stats,
    optionsAt(seam: SeamState): Promise<readonly StepData[]> {
      const cached = cache.get(seam);
      if (cached) return cached;
      // A rejected lookup is evicted rather than memoized: caching a failure
      // would turn one transient dataset error into a permanently empty seam
      // for the life of the provider.
      const pending = lookUp(seam).catch((error: unknown) => {
        cache.delete(seam);
        throw error;
      });
      cache.set(seam, pending);
      return pending;
    },
  };
}
