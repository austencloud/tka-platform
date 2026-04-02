import type { RoomNode, RoomEdge, GridConfig, ValidationResult } from "../../domain/layout-types";
import type { MuseumGrid } from "../../domain/museum-grid-types";

export interface MuseumGridBuildResult {
  grid: MuseumGrid;
  validation: ValidationResult;
}

export interface IMuseumGridBuilder {
  build(rooms: RoomNode[], edges: RoomEdge[], config: GridConfig): MuseumGridBuildResult;
}
