import { z } from "zod";
// Leaf import (pure zod), not the barrel: keeps this domain module free of the
// firebase/firestore runtime that the barrel transitively pulls in.
import { firestoreDate } from "$lib/shared/firestore/firestore-helpers";
import type { Timestamp } from "firebase/firestore";

/** A single base adjustment, pre directional-tuple rotation. */
export type PlacementValue = [number, number];

/** placementKey → turns → [x, y]. The same shape ArrowPlacer builds in memory. */
export type PlacementsMap = Record<string, Record<string, PlacementValue>>;

/** One Firestore doc = one (gridMode, propType, motionType) file's worth of placements. */
export interface DefaultArrowPlacementDoc {
  readonly id: string; // "{gridMode}_{propType}_{motionType}"
  readonly gridMode: string;
  readonly propType: string;
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
    propType: z.string().default("staff"),
    motionType: z.string(),
    placements: z.record(z.string(), z.record(z.string(), PlacementValueSchema)),
    updatedAt: firestoreDate.optional(),
    updatedBy: z.string(),
  })
  .passthrough();

/** Doc id mirrors the static file with a prop segment: "{gridMode}_{propType}_{motionType}". */
export function generateDefaultDocId(gridMode: string, propType: string, motionType: string): string {
  return `${gridMode}_${propType}_${motionType}`;
}

export function parseDefaultDocId(
  docId: string,
): { gridMode: string; propType: string; motionType: string } | null {
  const parts = docId.split("_");
  // Legacy 2-part ids ("{gridMode}_{motionType}") predate the prop dimension → staff.
  if (parts.length === 2) {
    const [gridMode, motionType] = parts;
    if (!gridMode || !motionType) return null;
    return { gridMode, propType: "staff", motionType };
  }
  if (parts.length === 3) {
    const [gridMode, propType, motionType] = parts;
    if (!gridMode || !propType || !motionType) return null;
    return { gridMode, propType, motionType };
  }
  return null;
}

/** Build a doc body from an in-memory placements map. Inverse of a doc read. */
export function flattenPlacements(
  gridMode: string,
  propType: string,
  motionType: string,
  placements: PlacementsMap,
  updatedBy: string,
): { gridMode: string; propType: string; motionType: string; placements: PlacementsMap; updatedBy: string } {
  return { gridMode, propType, motionType, placements, updatedBy };
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
