import type { MotionData, PropPlacementData } from "@tka/types";
import type { PropRenderData } from "../../../domain/PropRenderData";
import type { ThemeMode } from "../../../utils/svg-color-utils";

export interface PropSvgLoadOptions {
  themeMode?: ThemeMode;
}

export interface IPropSvgLoader {
  loadPropSvg(
    propData: PropPlacementData,
    motionData: MotionData,
    useGridVersion?: boolean,
    options?: PropSvgLoadOptions
  ): Promise<PropRenderData>;

  fetchSvgContent(path: string): Promise<string>;
}
