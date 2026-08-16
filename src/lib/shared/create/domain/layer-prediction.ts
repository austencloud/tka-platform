/**
 * What layers a sequence will walk through, worked out before it exists.
 *
 * A sequence's layer signature — which of the four radial/non-radial
 * combinations the two props sit in, step by step — is its starting layer plus,
 * step by step, which props crossed. The starting layer comes from the two
 * start orientations and the crossings come from the turns, and neither depends
 * on which letters get chosen. So both halves are known while the user is still
 * setting up the generator, and the signature can be shown before they press
 * the button.
 *
 * The one thing that cannot be known ahead of time is a float. A float takes a
 * prop across only when its hand travels around the circle, and which way the
 * hand travels is a property of the letter. Those are reported as uncertain
 * rather than guessed at.
 */

import {
  applyFlip,
  formatSignature,
  layerOf,
  type FlipVector,
  type LayerId,
} from "$lib/shared/foundation/domain/layer-signature";
import type { TurnValue } from "./turn-pattern-data";

export interface LayerPredictionInput {
  readonly blueStartOrientation: string;
  readonly redStartOrientation: string;
  readonly lanes: {
    readonly blue: readonly TurnValue[];
    readonly red: readonly TurnValue[];
  };
  /** How many steps to project the period across. */
  readonly length: number;
}

export interface LayerPrediction {
  /** Layers per step, e.g. "3131". Empty when there is nothing to show. */
  readonly signature: string;
  /** True when a float made at least one step unknowable. */
  readonly uncertain: boolean;
}

/** A prop crosses on a half turn and stays put on a whole one. */
function crosses(turn: TurnValue | undefined): boolean {
  return typeof turn === "number" && !Number.isInteger(turn);
}

function flipFor(
  blue: TurnValue | undefined,
  red: TurnValue | undefined
): FlipVector {
  const b = crosses(blue);
  const r = crosses(red);
  if (b && r) return "X";
  if (b) return "B";
  if (r) return "R";
  return ".";
}

export function predictLayerSignature(
  input: LayerPredictionInput
): LayerPrediction {
  const { blue, red } = input.lanes;
  const start = layerOf(input.blueStartOrientation, input.redStartOrientation);

  if (!start || blue.length === 0 || red.length === 0 || input.length <= 0) {
    return { signature: "", uncertain: false };
  }

  const layers: LayerId[] = [];
  let current: LayerId = start;
  let uncertain = false;

  for (let i = 0; i < input.length; i++) {
    const b = blue[i % blue.length];
    const r = red[i % red.length];
    if (b === "fl" || r === "fl") uncertain = true;
    current = applyFlip(current, flipFor(b, r));
    layers.push(current);
  }

  return { signature: formatSignature(layers), uncertain };
}
