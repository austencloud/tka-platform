/**
 * Orientation Checker Implementation
 */

import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { IOrientationChecker } from "../contracts/IOrientationChecker";
import { Orientation } from "../../../shared/domain/enums/pictograph-enums";

export class OrientationChecker implements IOrientationChecker {
  constructor(private motionDataSet: { red: MotionData; blue: MotionData }) {}

  isRadial(): boolean {
    const redEndOri = this.motionDataSet.red.endOrientation;
    const blueEndOri = this.motionDataSet.blue.endOrientation;

    const redIsInOrOut =
      redEndOri === Orientation.IN || redEndOri === Orientation.OUT;
    const blueIsIn = blueEndOri === Orientation.IN;
    const blueIsOut = blueEndOri === Orientation.OUT;

    return (redIsInOrOut && blueIsIn) || blueIsOut;
  }

  isNonRadial(): boolean {
    const redEndOri = this.motionDataSet.red.endOrientation;
    const blueEndOri = this.motionDataSet.blue.endOrientation;

    const redIsClockOrCounter =
      redEndOri === Orientation.CLOCK || redEndOri === Orientation.COUNTER;
    const blueIsClock = blueEndOri === Orientation.CLOCK;
    const blueIsCounter = blueEndOri === Orientation.COUNTER;

    return (redIsClockOrCounter && blueIsClock) || blueIsCounter;
  }
}
