/**
 * arrange-keyboard-handler - Keyboard shortcuts for the arrange grid
 *
 * Extracted from ArrangeTab.svelte to isolate the non-trivial navigation
 * algorithm and keyboard dispatch logic into a testable module.
 */

import type { GridCell } from "../state/arrange-grid-state.svelte";
import type { KeyboardContext, KeyboardCallbacks } from "./types";

export function handleKeyDown(
  e: KeyboardEvent,
  context: KeyboardContext,
  callbacks: KeyboardCallbacks
): boolean {
  const target = e.target as HTMLElement;

  // Don't intercept if user is typing in an input
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    return false;
  }

  // Don't intercept if modals are open
  if (context.isModalOpen) {
    return false;
  }

  switch (e.key) {
    case "Delete":
    case "Backspace":
      if (
        context.selectedCellId !== null &&
        context.selectedCell &&
        context.selectedCell.layers.length > 0
      ) {
        e.preventDefault();
        callbacks.clearCell();
        return true;
      }
      return false;

    case "Escape":
      if (context.selectedCellId !== null) {
        e.preventDefault();
        callbacks.deselectCell();
        return true;
      }
      return false;

    case "ArrowUp":
    case "ArrowDown":
    case "ArrowLeft":
    case "ArrowRight":
      e.preventDefault();
      callbacks.selectCell(e.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight");
      return true;

    case " ":
      if (target.tagName !== "BUTTON" && context.hasAnyLayers) {
        e.preventDefault();
        callbacks.playPause();
        return true;
      }
      return false;

    case "c":
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (
          context.selectedCellId !== null &&
          context.selectedCell?.layers.length
        ) {
          callbacks.copyCell();
        }
        return true;
      }
      return false;

    case "v":
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (context.selectedCellId !== null && context.hasClipboard) {
          callbacks.pasteLayer();
        }
        return true;
      }
      return false;

    default:
      break;
  }

  return false;
}

export function findAdjacentCell(
  direction: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
  currentCell: GridCell | null,
  visibleCells: GridCell[]
): string | null {
  if (visibleCells.length === 0) return null;

  // If no cell selected, select the first one (top-left)
  if (!currentCell) {
    const sorted = [...visibleCells].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
    return sorted[0]?.id ?? null;
  }

  // Calculate target position
  let targetRow = currentCell.row;
  let targetCol = currentCell.col;

  switch (direction) {
    case "ArrowUp":
      targetRow--;
      break;
    case "ArrowDown":
      targetRow++;
      break;
    case "ArrowLeft":
      targetCol--;
      break;
    case "ArrowRight":
      targetCol++;
      break;
  }

  // Exact match at target position
  const exact = visibleCells.find(
    (c) => c.row === targetRow && c.col === targetCol
  );
  if (exact) return exact.id;

  // Fallback: closest cell in that direction
  const candidates = visibleCells.filter((c) => {
    switch (direction) {
      case "ArrowUp":
        return c.row < currentCell.row;
      case "ArrowDown":
        return c.row > currentCell.row;
      case "ArrowLeft":
        return c.col < currentCell.col;
      case "ArrowRight":
        return c.col > currentCell.col;
      default:
        return false;
    }
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const distA =
      Math.abs(a.row - currentCell.row) + Math.abs(a.col - currentCell.col);
    const distB =
      Math.abs(b.row - currentCell.row) + Math.abs(b.col - currentCell.col);
    return distA - distB;
  });

  return candidates[0]?.id ?? null;
}
