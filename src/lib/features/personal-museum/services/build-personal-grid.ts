import { buildMuseumGrid } from "../../museum/services/museum-grid-builder";
import type {
  MuseumGrid,
  ExhibitDefinition,
  PerformerDefinition,
} from "../../museum/domain/museum-grid-types";
import {
  PERSONAL_MUSEUM_ROOMS,
  PERSONAL_MUSEUM_EDGES,
  PERSONAL_MUSEUM_GRID_CONFIG,
} from "../data/personal-museum-room-graph";

/** Set each exhibit's sequenceId (and plaque title) from the resolved slot map. */
export function applySequenceOverrides(
  exhibits: ExhibitDefinition[],
  resolved: Record<string, string | null>,
  slotMeta: Record<string, { name: string }> = {},
): ExhibitDefinition[] {
  return exhibits.map((ex) => {
    const seq = resolved[ex.id];
    if (seq) {
      return {
        ...ex,
        sequenceId: seq,
        plaque: { title: slotMeta[ex.id]?.name ?? ex.id, body: "" },
      };
    }
    return { ...ex, sequenceId: undefined };
  });
}

/** Set each performer's sequenceId + autoPlay from the resolved slot map. */
export function applyPerformerOverrides(
  performers: PerformerDefinition[],
  resolved: Record<string, string | null>,
): PerformerDefinition[] {
  return performers.map((p) => {
    const seq = resolved[p.id] ?? undefined;
    return { ...p, sequenceId: seq, autoPlay: seq !== undefined };
  });
}

/** Build the personal grid and overlay the resolved sequences on exhibits + performers. */
export function buildPersonalGrid(
  resolved: Record<string, string | null>,
  slotMeta: Record<string, { name: string }> = {},
): MuseumGrid {
  const { grid } = buildMuseumGrid(
    PERSONAL_MUSEUM_ROOMS,
    PERSONAL_MUSEUM_EDGES,
    PERSONAL_MUSEUM_GRID_CONFIG,
  );
  return {
    ...grid,
    exhibits: applySequenceOverrides(grid.exhibits, resolved, slotMeta),
    performers: applyPerformerOverrides(grid.performers, resolved),
  };
}
