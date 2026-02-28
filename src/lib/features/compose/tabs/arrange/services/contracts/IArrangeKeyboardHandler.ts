/**
 * IArrangeKeyboardHandler - Contract for arrange tab keyboard shortcuts
 *
 * Handles keyboard events for the grid composition builder:
 * - Arrow key navigation between cells
 * - Clipboard operations (Ctrl+C/V)
 * - Undo/redo (Ctrl+Z/Y)
 * - Play/pause (Space)
 * - Delete/clear (Delete/Backspace)
 * - Escape to deselect
 * - Transform hotkeys (R/M/V/S/I, Shift+R) on selected cell layer 0
 */

import type { GridCell } from "../../state/arrange-grid-state.svelte";
import type { TransformType } from "../../../../compose/domain/types";

/**
 * Snapshot of UI state needed to decide how to handle a keypress.
 * Passed in by the component so the handler stays UI-framework-agnostic.
 */
export interface KeyboardContext {
  /** Whether any modal/overlay is open (sequence picker, stagger, save) */
  isModalOpen: boolean;
  /** Whether the device is mobile (keyboard shortcuts disabled) */
  isMobile: boolean;
  /** Currently selected cell, if any */
  selectedCell: GridCell | null;
  /** ID of the currently selected cell */
  selectedCellId: string | null;
  /** Whether clipboard has data for pasting */
  hasClipboard: boolean;
  /** Whether any cell has layers (for play/pause gate) */
  hasAnyLayers: boolean;
}

/**
 * Callbacks the handler invokes in response to keyboard events.
 * The component provides these to wire keyboard actions to state mutations and toasts.
 */
export interface KeyboardCallbacks {
  clearCell(): void;
  deselectCell(): void;
  selectCell(cellId: string): void;
  playPause(): void;
  copyCell(): void;
  pasteLayer(): void;
  undo(): void;
  redo(): void;
  transformLayer(layerIndex: number, transformType: TransformType): void;
}

export interface IArrangeKeyboardHandler {
  /**
   * Process a keyboard event given the current UI context.
   * Returns true if the event was handled (and preventDefault was called).
   */
  handleKeyDown(
    e: KeyboardEvent,
    context: KeyboardContext,
    callbacks: KeyboardCallbacks
  ): boolean;

  /**
   * Navigate to the adjacent cell in the given arrow-key direction.
   * Returns the cell ID to select, or null if no valid target exists.
   */
  findAdjacentCell(
    direction: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
    currentCell: GridCell | null,
    visibleCells: GridCell[]
  ): string | null;
}
