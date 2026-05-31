import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";

export interface VariationArrow {
  pictographData: PictographData;
  arrowColor: "blue" | "red";
}

/** Yields every (pictograph variation, arrow) pair the renderer can draw,
 *  across diamond + box. Source: the app's CSV-backed variation dataset
 *  via letterQueryHandler.getAllPictographVariations. */
export async function enumerateVariationArrows(): Promise<VariationArrow[]> {
  const diamond = await letterQueryHandler.getAllPictographVariations(
    GridMode.DIAMOND
  );
  const box = await letterQueryHandler.getAllPictographVariations(GridMode.BOX);
  const out: VariationArrow[] = [];
  for (const pictographData of [...diamond, ...box]) {
    if (pictographData.motions?.blue)
      out.push({ pictographData, arrowColor: "blue" });
    if (pictographData.motions?.red)
      out.push({ pictographData, arrowColor: "red" });
  }
  return out;
}
