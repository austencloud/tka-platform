import type { PictographData, PropType } from "@tka/types";
import type { PreparedPictographData } from "../../../domain/PreparedPictographData";
import type { ThemeMode } from "../../../utils/svg-color-utils";

export type { PreparedPictographData };

export interface PrepareOptions {
  themeMode?: ThemeMode;
  bluePropType?: PropType;
  redPropType?: PropType;
  useAnimatedVersion?: boolean;
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
