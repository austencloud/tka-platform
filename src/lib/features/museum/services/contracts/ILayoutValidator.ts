import type { MuseumGrid } from "../../domain/museum-grid-types";
import type { PlacedRoom, ValidationResult } from "../../domain/layout-types";

export interface ILayoutValidator {
  validate(grid: MuseumGrid, rooms: PlacedRoom[]): ValidationResult;
}
