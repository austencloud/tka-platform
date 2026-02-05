import type { GridMode } from "../../domain/enums/grid-enums";

export interface IGridRenderer {
  renderGrid(svg: SVGElement, gridMode?: GridMode): Promise<void>;
}
