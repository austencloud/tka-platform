import type { MotionColor } from "@tka/types";
import type { ThemeMode } from "../../../../utils/svg-color-utils";

export interface IArrowSvgColorTransformer {
  applyColorToSvg(
    svgText: string,
    color: MotionColor,
    themeMode?: ThemeMode
  ): string;
}
