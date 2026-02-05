/**
 * Pictograph Rendering Service Interface
 *
 * Main interface for rendering complete pictographs.
 * Orchestrates the rendering of all pictograph elements.
 */

import type { PictographData } from "../../domain/models/PictographData";

export interface IPictographRenderer {
  renderPictograph(data: PictographData): Promise<SVGElement>;
}
