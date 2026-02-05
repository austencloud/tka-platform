/**
 * Beta Prop Direction Calculator
 *
 * Lightweight orchestrator that delegates direction calculation to specialized handlers
 * based on letter type (I, G/H, Y/Z) and motion type (SHIFT vs STATIC/DASH).
 *
 * @see Legacy: legacy_web/BetaPropDirectionCalculator.ts
 */

import { MotionType } from "../../../shared/domain/enums/pictograph-enums";
import type { VectorDirection } from "../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { PropPlacementData } from "../../domain/models/PropPlacementData";
import { LetterGHHandler } from "./LetterGHHandler";
import { LetterIHandler } from "./LetterIHandler";
import { LetterYZHandler } from "./LetterYZHandler";
import { OrientationChecker } from "./OrientationChecker";
import { ShiftMotionHandler } from "./ShiftMotionHandler";
import { StaticDashMotionHandler } from "./StaticDashMotionHandler";

export class BetaPropDirectionCalculator {
  private orientationChecker: OrientationChecker;
  private staticDashHandler: StaticDashMotionHandler;
  private shiftHandler: ShiftMotionHandler;
  private letterIHandler: LetterIHandler;
  private letterGHHandler: LetterGHHandler;
  private letterYZHandler: LetterYZHandler;

  constructor(
    private motionDataSet: { red: MotionData; blue: MotionData },
    private pictographLetter?: string
  ) {
    this.orientationChecker = new OrientationChecker(motionDataSet);
    this.staticDashHandler = new StaticDashMotionHandler(
      this.orientationChecker
    );
    this.shiftHandler = new ShiftMotionHandler(this.orientationChecker);
    this.letterIHandler = new LetterIHandler(this.orientationChecker);
    this.letterGHHandler = new LetterGHHandler(this.orientationChecker);
    this.letterYZHandler = new LetterYZHandler(
      motionDataSet,
      this.shiftHandler
    );
  }

  /** @deprecated Use getDirectionForMotionData() directly with the specific motion. */
  getDirection(_prop: PropPlacementData): VectorDirection | null {
    const motionData = this.motionDataSet.blue || this.motionDataSet.red;
    if (!motionData) {
      console.error(`No motion data available for direction calculation`);
      return null;
    }
    return this.getDirectionForMotionData(motionData);
  }

  getDirectionForMotionData(motionData: MotionData): VectorDirection | null {
    if (!motionData) {
      return null;
    }

    if (this.isYOrZLetter()) {
      return this.letterYZHandler.calculate(motionData);
    }

    if (this.isShiftMotion(motionData)) {
      if (this.isGOrHLetter()) {
        return this.letterGHHandler.calculate(motionData);
      }
      if (this.pictographLetter === "I") {
        return this.letterIHandler.calculate(motionData);
      }
      return this.shiftHandler.calculate(motionData);
    }

    return this.staticDashHandler.calculate(motionData);
  }

  private isYOrZLetter(): boolean {
    return (
      this.pictographLetter === "Y" ||
      this.pictographLetter === "Z" ||
      this.pictographLetter === "Y-" ||
      this.pictographLetter === "Z-"
    );
  }

  private isGOrHLetter(): boolean {
    return this.pictographLetter === "G" || this.pictographLetter === "H";
  }

  private isShiftMotion(motion: MotionData): boolean {
    return [MotionType.PRO, MotionType.ANTI, MotionType.FLOAT].includes(
      motion.motionType
    );
  }
}
