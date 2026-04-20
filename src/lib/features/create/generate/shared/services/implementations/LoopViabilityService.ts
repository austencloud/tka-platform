import {
  LOOPType,
  ROTATED_LOOP_TYPES,
} from "../../../circular/domain/models/circular-models";
import type {
  ILoopViabilityService,
  LoopViabilityArgs,
  LoopViabilityCheck,
} from "../contracts/ILoopViabilityService";

const VIABLE: LoopViabilityCheck = Object.freeze({ viable: true });

/**
 * Minimum level at which half turns (0.5) are available. Half turns provide
 * the per-pass wheel quarter-advance that enables period-4 closure on
 * non-rotated LOOP primitives.
 */
const HALF_TURN_LEVEL = 3;

export class LoopViabilityService implements ILoopViabilityService {
  check(args: LoopViabilityArgs): LoopViabilityCheck {
    const { loopType, period, level } = args;

    if (period === 2) return VIABLE;

    if (period === 4) {
      if (ROTATED_LOOP_TYPES.has(loopType)) return VIABLE;

      if (loopType === LOOPType.STRICT_REWOUND) {
        return {
          viable: false,
          reason: "Quartered rewound is not a valid LOOP.",
          suggestion:
            "Rewound is a temporal reversal (order 2). Use halved, or pick a spatial LOOP type.",
        };
      }

      if (level !== undefined && level < HALF_TURN_LEVEL) {
        return {
          viable: false,
          reason: `Quartered ${loopType} requires Level ${HALF_TURN_LEVEL} or higher.`,
          suggestion:
            "Raise the level to unlock half turns, or switch to halved.",
        };
      }

      return VIABLE;
    }

    if (period === 1) {
      return {
        viable: false,
        reason: "Period 1 is not a LOOP.",
      };
    }

    if (period === 8) {
      return {
        viable: false,
        reason: "Period 8 requires Level 7+.",
        suggestion: "Not yet available. Choose period 2 or 4.",
      };
    }

    return {
      viable: false,
      reason: `Period ${period} is not supported.`,
      suggestion: "Valid periods are 2 and 4.",
    };
  }
}

export const loopViabilityService = new LoopViabilityService();
