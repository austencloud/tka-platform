// --- From CSVPictographParser ---

import type { PictographData } from "../../../../pictograph/shared/domain/models/PictographData";
import type { GridMode } from "../../../../pictograph/grid/domain/enums/grid-enums";

export interface CSVRow {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blueMotionType: string;
  blueRotationDirection: string;
  blueStartLocation: string;
  blueEndLocation: string;
  redMotionType: string;
  redRotationDirection: string;
  redStartLocation: string;
  redEndLocation: string;
  // Skewed mode fields (optional - only present in SkewedPictographDataframe.csv)
  blueSkewDir?: string;
  blueHandPath?: string;
  blueSkewSteps?: string;
  redSkewDir?: string;
  redHandPath?: string;
  redSkewSteps?: string;
  category?: string;
}
