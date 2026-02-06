import type { PictographData, PropType } from "@tka/types";
import type { PreparedPictographData } from "../../../domain/PreparedPictographData";
import type { ThemeMode } from "../../../utils/svg-color-utils";

export type { PreparedPictographData };

export interface PrepareOptions {
  themeMode?: ThemeMode;
  bluePropType?: PropType;
  redPropType?: PropType;
  /**
   * Load grid-centered prop SVGs (from props/animated/) instead of thumbnail versions.
   * Grid versions use ghost-half centering so the hand grip aligns with grid points.
   * Defaults to true since pictographs render on a grid.
   */
  useGridVersion?: boolean;
}

export interface IPictographPreparer {
  prepareBatch(
    pictographs: PictographData[],
    options?: PrepareOptions
  ): Promise<PreparedPictographData[]>;

  prepareSingle(
    pictograph: PictographData,
    options?: PrepareOptions
  ): Promise<PreparedPictographData>;

  clearCache(): void;
}
