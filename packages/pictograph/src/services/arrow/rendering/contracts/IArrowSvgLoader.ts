import type { ArrowPlacementData, ArrowSvgData, MotionData } from "@tka/types";
import type { ThemeMode } from "../../../../utils/svg-color-utils";

export interface ArrowSvgLoadOptions {
  themeMode?: ThemeMode;
}

export interface IArrowSvgLoader {
  loadArrowSvg(
    arrowData: ArrowPlacementData,
    motionData: MotionData,
    options?: ArrowSvgLoadOptions
  ): Promise<ArrowSvgData>;

  fetchSvgContent(path: string): Promise<string>;
}
