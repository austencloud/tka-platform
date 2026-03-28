/**
 * IMuseumGridPersister
 *
 * Saves and loads MuseumGrid layouts. Phase 1 supports JSON string
 * serialization. Firestore persistence will be added in a later phase.
 */

import type { MuseumGrid } from "../../domain/museum-grid-types";

export interface IMuseumGridPersister {
	saveToJson(grid: MuseumGrid): string;
	loadFromJson(json: string): MuseumGrid;
	saveToFirestore(userId: string, grid: MuseumGrid): Promise<void>;
	loadFromFirestore(userId: string): Promise<MuseumGrid | null>;
}
