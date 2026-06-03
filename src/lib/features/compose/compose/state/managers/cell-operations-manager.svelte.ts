/**
 * Cell Operations Manager
 *
 * Manages cell CRUD operations for the composition grid.
 * Extracted from composition-state.svelte.ts for single responsibility.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { TrailSettings } from "$lib/shared/animation-engine/domain/types/trail-types";
import type { Composition, CellConfig, CellType } from "$lib/shared/animation-engine/domain/compose-types";

export type CellOperationsManager = ReturnType<
  typeof createCellOperationsManager
>;

interface CompositionAccessor {
  get: () => Composition;
  set: (comp: Composition) => void;
}

export function createCellOperationsManager(accessor: CompositionAccessor) {
  // =========================================================================
  // Core Update
  // =========================================================================

  function updateCell(cellId: string, updates: Partial<CellConfig>) {
    const composition = accessor.get();
    const cellIndex = composition.cells.findIndex((c) => c.id === cellId);
    if (cellIndex === -1) return;

    const existingCell = composition.cells[cellIndex];
    if (!existingCell) return;

    const updatedCells = [...composition.cells];
    updatedCells[cellIndex] = { ...existingCell, ...updates };

    accessor.set({
      ...composition,
      cells: updatedCells,
      updatedAt: new Date(),
    });
  }

  // =========================================================================
  // Type Operations
  // =========================================================================

  function setType(cellId: string, type: CellType) {
    const composition = accessor.get();
    const cell = composition.cells.find((c) => c.id === cellId);
    if (!cell) return;

    // If switching from tunnel to single, keep only first sequence
    let sequences = cell.sequences;
    if (type === "single" && cell.sequences.length > 1) {
      const firstSequence = cell.sequences[0];
      sequences = firstSequence ? [firstSequence] : [];
    }

    updateCell(cellId, { type, sequences });
  }

  function setMediaType(
    cellId: string,
    mediaType: "animation" | "video" | "stepGrid" | "image"
  ) {
    updateCell(cellId, { mediaType });
  }

  // =========================================================================
  // Sequence Operations
  // =========================================================================

  function setSequences(cellId: string, sequences: SequenceData[]) {
    updateCell(cellId, { sequences });
  }

  function addSequence(cellId: string, sequence: SequenceData) {
    const composition = accessor.get();
    const cell = composition.cells.find((c) => c.id === cellId);
    if (!cell) return;

    const maxSequences = cell.type === "tunnel" ? 4 : 1;
    if (cell.sequences.length >= maxSequences) {
      // Replace last sequence if at max
      const newSequences = [...cell.sequences.slice(0, -1), sequence];
      setSequences(cellId, newSequences);
    } else {
      setSequences(cellId, [...cell.sequences, sequence]);
    }
  }

  function removeSequence(cellId: string, sequenceIndex: number) {
    const composition = accessor.get();
    const cell = composition.cells.find((c) => c.id === cellId);
    if (!cell || sequenceIndex < 0 || sequenceIndex >= cell.sequences.length) {
      return;
    }

    const newSequences = cell.sequences.filter((_, i) => i !== sequenceIndex);
    setSequences(cellId, newSequences);
  }

  // =========================================================================
  // Trail & Transform Operations
  // =========================================================================

  function setTrailSettings(cellId: string, settings: Partial<TrailSettings>) {
    const composition = accessor.get();
    const cell = composition.cells.find((c) => c.id === cellId);
    if (!cell) return;

    updateCell(cellId, {
      trailSettings: { ...cell.trailSettings, ...settings },
    });
  }

  function setRotation(cellId: string, rotation: number) {
    updateCell(cellId, { rotationOffset: rotation });
  }

  // =========================================================================
  // Clear
  // =========================================================================

  function clear(cellId: string) {
    updateCell(cellId, {
      sequences: [],
      type: "single",
      rotationOffset: 0,
      isMirrored: false,
      mirrorSourceCellId: undefined,
    });
  }

  // =========================================================================
  // Return API
  // =========================================================================

  return {
    updateCell,
    setType,
    setMediaType,
    setSequences,
    addSequence,
    removeSequence,
    setTrailSettings,
    setRotation,
    clear,
  };
}
