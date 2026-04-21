import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import type { StickerUnit } from "../../domain/sticker-types";

export interface IStickerUnitRenderer {
  /**
   * Render a single sticker as a self-contained SVG string sized STICKER_TILE_SIZE_PX
   * square (art + bleed on all sides). The SVG uses the light-mode prop palette
   * (white-paper-safe colors).
   */
  renderSVG(unit: StickerUnit, mandalaPaths: MandalaPaths): string;
}
