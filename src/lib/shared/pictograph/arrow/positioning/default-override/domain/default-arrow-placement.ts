import { z } from "zod";
// Pure-zod leaf module (no firebase/auth): keeps this domain worker-safe. The
// barrel AND firestore-helpers both transitively import authState → $app/navigation
// → SvelteKit client, which crashes the composition worker.
import { firestoreDate } from "$lib/shared/firestore/firestore-date";
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
  // gridMode (diamond/box/skewed) and motionType (pro/anti/float/dash/static)
  // are single tokens with no underscore, so the first segment is always the
  // gridMode and the last is always the motionType. propType is everything in
  // between — joined with "_" so multi-token props (simple_staff, staff_v2)
  // round-trip. A legacy 2-part id ("{gridMode}_{motionType}") predates the
  // prop dimension → staff.
  const parts = docId.split("_");
  if (parts.length < 2) return null;
  const gridMode = parts[0];
  const motionType = parts[parts.length - 1];
  if (!gridMode || !motionType) return null;
  const propType = parts.length === 2 ? "staff" : parts.slice(1, -1).join("_");
  return { gridMode, propType, motionType };
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
