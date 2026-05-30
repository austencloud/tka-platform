import { z } from "zod";
import { firestoreDate } from "$lib/shared/firestore";
import type { Timestamp } from "firebase/firestore";

/** A single base adjustment, pre directional-tuple rotation. */
export type PlacementValue = [number, number];

/** placementKey → turns → [x, y]. The same shape ArrowPlacer builds in memory. */
export type PlacementsMap = Record<string, Record<string, PlacementValue>>;

/** One Firestore doc = one (gridMode, motionType) file's worth of placements. */
export interface DefaultArrowPlacementDoc {
  readonly id: string; // "{gridMode}_{motionType}"
  readonly gridMode: string;
  readonly motionType: string;
  readonly placements: PlacementsMap;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

const PlacementValueSchema = z.tuple([z.number(), z.number()]);

export const DefaultArrowPlacementDocSchema = z
  .object({
    id: z.string(),
    gridMode: z.string(),
    motionType: z.string(),
    placements: z.record(z.string(), z.record(z.string(), PlacementValueSchema)),
    updatedAt: firestoreDate.optional(),
    updatedBy: z.string(),
  })
  .passthrough();

/** Doc id is the 1:1 mirror of the static file: "{gridMode}_{motionType}". */
export function generateDefaultDocId(gridMode: string, motionType: string): string {
  return `${gridMode}_${motionType}`;
}

export function parseDefaultDocId(
  docId: string,
): { gridMode: string; motionType: string } | null {
  const parts = docId.split("_");
  if (parts.length !== 2) return null;
  const [gridMode, motionType] = parts;
  if (!gridMode || !motionType) return null;
  return { gridMode, motionType };
}

/** Build a doc body from an in-memory placements map (used by the seed + local writes). */
export function flattenPlacements(
  gridMode: string,
  motionType: string,
  placements: PlacementsMap,
  updatedBy: string,
): {
  gridMode: string;
  motionType: string;
  placements: PlacementsMap;
  updatedBy: string;
} {
  return { gridMode, motionType, placements, updatedBy };
}

/** Read a single base value out of a placements map; null if absent. */
export function unflattenValue(
  placements: PlacementsMap,
  placementKey: string,
  turns: string,
): PlacementValue | null {
  const byTurns = placements[placementKey];
  if (!byTurns) return null;
  const value = byTurns[turns];
  return value ?? null;
}
