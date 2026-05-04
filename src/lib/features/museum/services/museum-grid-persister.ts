/**
 * MuseumGridPersister
 *
 * Phase 1: JSON string serialization via the existing
 * serializeGrid/deserializeGrid helpers.
 * Phase 2: Firestore read/write (not yet implemented).
 */

import type { MuseumGrid } from "../domain/museum-grid-types";
import { serializeGrid, deserializeGrid } from "../domain/museum-grid-types";

export function saveToJson(grid: MuseumGrid): string {
  const serialized = serializeGrid(grid);
  return JSON.stringify(serialized);
}

export function loadFromJson(json: string): MuseumGrid {
  const parsed = JSON.parse(json);
  return deserializeGrid(parsed);
}

export async function saveToFirestore(_userId: string, _grid: MuseumGrid): Promise<void> {
  throw new Error(
    "saveToFirestore is not implemented yet. " +
    "Firestore persistence will be added in a later phase.",
  );
}

export async function loadFromFirestore(_userId: string): Promise<MuseumGrid | null> {
  throw new Error(
    "loadFromFirestore is not implemented yet. " +
    "Firestore persistence will be added in a later phase.",
  );
}
