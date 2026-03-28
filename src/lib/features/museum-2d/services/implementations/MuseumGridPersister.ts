/**
 * MuseumGridPersister
 *
 * Phase 1: JSON string serialization via the existing
 * serializeGrid/deserializeGrid helpers.
 * Phase 2: Firestore read/write (not yet implemented).
 */

import type { MuseumGrid } from "../../domain/museum-grid-types";
import { serializeGrid, deserializeGrid } from "../../domain/museum-grid-types";
import type { IMuseumGridPersister } from "../contracts/IMuseumGridPersister";

export class MuseumGridPersister implements IMuseumGridPersister {
	saveToJson(grid: MuseumGrid): string {
		const serialized = serializeGrid(grid);
		return JSON.stringify(serialized);
	}

	loadFromJson(json: string): MuseumGrid {
		const parsed = JSON.parse(json);
		return deserializeGrid(parsed);
	}

	async saveToFirestore(_userId: string, _grid: MuseumGrid): Promise<void> {
		throw new Error(
			"MuseumGridPersister.saveToFirestore is not implemented yet. " +
			"Firestore persistence will be added in a later phase.",
		);
	}

	async loadFromFirestore(_userId: string): Promise<MuseumGrid | null> {
		throw new Error(
			"MuseumGridPersister.loadFromFirestore is not implemented yet. " +
			"Firestore persistence will be added in a later phase.",
		);
	}
}
