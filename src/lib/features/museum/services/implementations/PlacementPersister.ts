import { MANUAL_PLACEMENTS, type ManualPlacement } from '../../data/museum-manual-placements';
import type { IPlacementPersister } from '../contracts/IPlacementPersister';

/**
 * Persists manual editor placements to the in-memory MANUAL_PLACEMENTS record
 * and writes the full placements file back to disk via the Vite dev server endpoint.
 *
 * Why write to a .ts source file: placements are authored data, not runtime state.
 * Keeping them in version control means the geometry builder always has them at
 * build time, and every edit is a real git commit.
 */
export class PlacementPersister implements IPlacementPersister {
  save(roomId: string, placement: ManualPlacement): Promise<void> {
    if (!MANUAL_PLACEMENTS[roomId]) {
      MANUAL_PLACEMENTS[roomId] = [];
    }

    const existing = MANUAL_PLACEMENTS[roomId].findIndex((p) => p.id === placement.id);
    if (existing !== -1) {
      MANUAL_PLACEMENTS[roomId][existing] = placement;
    } else {
      MANUAL_PLACEMENTS[roomId].push(placement);
    }

    return this.writeToFile();
  }

  remove(roomId: string, placementId: string): Promise<void> {
    if (!MANUAL_PLACEMENTS[roomId]) {
      return Promise.resolve();
    }

    MANUAL_PLACEMENTS[roomId] = MANUAL_PLACEMENTS[roomId].filter((p) => p.id !== placementId);

    if (MANUAL_PLACEMENTS[roomId].length === 0) {
      delete MANUAL_PLACEMENTS[roomId];
    }

    return this.writeToFile();
  }

  getAll(roomId: string): ManualPlacement[] {
    return MANUAL_PLACEMENTS[roomId] ?? [];
  }

  private async writeToFile(): Promise<void> {
    const content = this.serializePlacements();

    const response = await fetch('/__museum-placements', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: content
    });

    if (!response.ok) {
      throw new Error(`Failed to write placements file: ${response.status} ${response.statusText}`);
    }
  }

  private serializePlacements(): string {
    const lines: string[] = [];

    lines.push(`import type { Direction } from '../domain/museum-grid-types';`);
    lines.push('');
    lines.push('export interface ManualPlacement {');
    lines.push('  id: string;');
    lines.push('  objectDefId: string;');
    lines.push('  tileX: number;');
    lines.push('  tileY: number;');
    lines.push('  wallFacing: Direction | null;');
    lines.push('  yaw: number;');
    lines.push('}');
    lines.push('');
    lines.push('/**');
    lines.push(' * Manual placements keyed by room ID. Written by the editor save action.');
    lines.push(' * The geometry builder reads this at build time to merge with auto-placed objects.');
    lines.push(' */');
    lines.push('export const MANUAL_PLACEMENTS: Record<string, ManualPlacement[]> = {');

    const roomIds = Object.keys(MANUAL_PLACEMENTS);

    if (roomIds.length === 0) {
      lines.push('  // Populated by editor — do not edit manually');
    } else {
      for (const roomId of roomIds) {
        const placements = MANUAL_PLACEMENTS[roomId] ?? [];
        lines.push(`  "${roomId}": [`);
        for (const p of placements) {
          const wallFacing = p.wallFacing === null ? 'null' : `"${p.wallFacing}"`;
          lines.push(
            `    { id: "${p.id}", objectDefId: "${p.objectDefId}", tileX: ${p.tileX}, tileY: ${p.tileY}, wallFacing: ${wallFacing}, yaw: ${p.yaw.toFixed(4)} },`
          );
        }
        lines.push('  ],');
      }
    }

    lines.push('};');
    lines.push('');

    return lines.join('\n');
  }
}
