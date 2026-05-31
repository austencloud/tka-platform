import { describe, it, expect, vi } from "vitest";
import { deriveSequenceLetters } from "./sequence-transforms";
import { createStepData } from "$lib/shared/create/factories/create-step-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";

describe("deriveSequenceLetters derives gridMode per-step", () => {
  it("looks up the letter under BOX for an intercardinal step even when sequence.gridMode is stale DIAMOND", async () => {
    const boxStep = createStepData({
      stepNumber: 1,
      motions: {
        [MotionColor.BLUE]: createMotionData({
          color: MotionColor.BLUE,
          startLocation: GridLocation.NORTHWEST,
          endLocation: GridLocation.NORTHEAST,
        }),
        [MotionColor.RED]: createMotionData({
          color: MotionColor.RED,
          startLocation: GridLocation.SOUTHWEST,
          endLocation: GridLocation.SOUTHEAST,
        }),
      },
    });

    const seq = {
      id: "s1",
      name: "t",
      word: "",
      steps: [boxStep],
      gridMode: GridMode.DIAMOND, // STALE
      difficulty: 1,
      metadata: {},
    } as unknown as SequenceData;

    const spy = vi.fn().mockResolvedValue("M");
    const handler = {
      findLetterByMotionConfiguration: spy,
    } as unknown as IMotionQueryHandler;

    await deriveSequenceLetters(seq, handler);

    expect(spy).toHaveBeenCalledTimes(1);
    const [, , gridModeArg] = spy.mock.calls[0]!;
    expect(gridModeArg).toBe(GridMode.BOX); // per-step, NOT the stale DIAMOND
  });
});
