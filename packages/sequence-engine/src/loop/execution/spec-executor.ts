import type { SequenceStep } from "../../core/types/sequence-engine-types.js";
import {
  LOOPComponent,
  type PropLOOPSpec,
  type LOOPSpec,
  specsAreEqual,
  EMPTY_PROP_SPEC,
} from "../loop-spec.js";
import { Period } from "../loop-types.js";
import { strictRotatedExecutor } from "./StrictRotatedExecutor.js";
import { rewoundExecutor } from "./RewoundExecutor.js";
import { FusedExecutor, type FusedTransformFlags } from "./FusedExecutor.js";

const FUSEABLE = new Set([
  LOOPComponent.MIRRORED,
  LOOPComponent.FLIPPED,
  LOOPComponent.SWAPPED,
  LOOPComponent.INVERTED,
]);

export function executeSymmetricSpec(
  sequence: SequenceStep[],
  spec: PropLOOPSpec,
): SequenceStep[] {
  if (spec.components.size === 0) return sequence;

  let result = sequence;

  if (spec.components.has(LOOPComponent.REWOUND)) {
    const period = spec.components.get(LOOPComponent.REWOUND)!.period;
    const periodEnum = period === 4 ? Period.QUARTERED : Period.HALVED;
    return rewoundExecutor.executeLOOP(result, periodEnum);
  }

  if (spec.components.has(LOOPComponent.ROTATED)) {
    const period = spec.components.get(LOOPComponent.ROTATED)!.period;
    const periodEnum = period === 4 ? Period.QUARTERED : Period.HALVED;
    result = strictRotatedExecutor.executeLOOP(result, periodEnum);
  }

  const groups = groupFuseableByPeriod(spec);
  for (const [period, flags] of groups) {
    const executor = new FusedExecutor(flags);
    result = executor.execute(result, period);
  }

  return result;
}

export function executeLOOPSpec(
  sequence: SequenceStep[],
  spec: LOOPSpec,
): SequenceStep[] {
  const blueSpec = spec.blue ?? EMPTY_PROP_SPEC;
  const redSpec = spec.red ?? EMPTY_PROP_SPEC;

  if (specsAreEqual(blueSpec, redSpec)) {
    return executeSymmetricSpec(sequence, blueSpec);
  }

  throw new Error(
    "Asymmetric LOOPSpec execution not yet implemented. " +
      "Per-prop independent execution requires Phase 3b follow-on.",
  );
}

function groupFuseableByPeriod(
  spec: PropLOOPSpec,
): Map<number, FusedTransformFlags> {
  const groups = new Map<
    number,
    { mirror: boolean; flip: boolean; swap: boolean; invert: boolean }
  >();

  for (const [comp, cSpec] of spec.components) {
    if (!FUSEABLE.has(comp)) continue;

    if (!groups.has(cSpec.period)) {
      groups.set(cSpec.period, {
        mirror: false,
        flip: false,
        swap: false,
        invert: false,
      });
    }
    const flags = groups.get(cSpec.period)!;
    if (comp === LOOPComponent.MIRRORED) flags.mirror = true;
    if (comp === LOOPComponent.FLIPPED) flags.flip = true;
    if (comp === LOOPComponent.SWAPPED) flags.swap = true;
    if (comp === LOOPComponent.INVERTED) flags.invert = true;
  }

  return new Map(
    [...groups.entries()].sort(([a], [b]) => b - a),
  ) as Map<number, FusedTransformFlags>;
}
