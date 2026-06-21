import { buildMuseumGrid } from "../../museum/services/museum-grid-builder";
import type {
  MuseumGrid,
  ExhibitDefinition,
} from "../../museum/domain/museum-grid-types";
import {
  PERSONAL_MUSEUM_ROOMS,
  PERSONAL_MUSEUM_EDGES,
  PERSONAL_MUSEUM_GRID_CONFIG,
} from "../data/personal-museum-room-graph";

/** Set each exhibit's sequenceId from the resolved slot map (exhibit.id === SlotId). */
export function applySequenceOverrides(
  exhibits: ExhibitDefinition[],
  resolved: Record<string, string | null>,
): ExhibitDefinition[] {
  return exhibits.map((ex) => {
    const seq = resolved[ex.id];
    return seq ? { ...ex, sequenceId: seq } : { ...ex, sequenceId: undefined };
  });
}

/** Build the personal grid and overlay the resolved sequences. */
export function buildPersonalGrid(resolved: Record<string, string | null>): MuseumGrid {
  const { grid } = buildMuseumGrid(
    PERSONAL_MUSEUM_ROOMS,
    PERSONAL_MUSEUM_EDGES,
    PERSONAL_MUSEUM_GRID_CONFIG,
  );
  return { ...grid, exhibits: applySequenceOverrides(grid.exhibits, resolved) };
}
