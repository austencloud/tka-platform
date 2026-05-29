/**
 * Gallery Selection State
 *
 * Manages batch selection mode for the screenshot gallery:
 * enter/exit selection, toggle individual items, select all, clear,
 * and bulk tag operations on selected items.
 */

import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
import type { ScreenshotTagController } from "../../../services/screenshot-tag-controller";
import type { GalleryItem } from "../../../services/types";
import type { MediaTag } from "@austencloud/media-tagging-types";

export interface GallerySelectionDeps {
  getHapticService: () => HapticFeedback | null;
  getTagController: () => ScreenshotTagController | null;
  getFlatItems: () => GalleryItem[];
}

export function createGallerySelectionState(deps: GallerySelectionDeps) {
  let selectionMode = $state(false);
  let selectedIds = $state<Set<string>>(new Set());

  function enterSelectionMode() {
    selectionMode = true;
    deps.getHapticService()?.trigger("selection");
  }

  function exitSelectionMode() {
    selectionMode = false;
    selectedIds = new Set();
    deps.getHapticService()?.trigger("selection");
  }

  function toggleSelection(itemId: string) {
    const next = new Set(selectedIds);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    selectedIds = next;
  }

  function selectAll() {
    selectedIds = new Set(deps.getFlatItems().map((item) => item.id));
  }

  function clearSelection() {
    selectedIds = new Set();
  }

  async function bulkApplyTag(tag: MediaTag) {
    const ids = [...selectedIds];
    const controller = deps.getTagController();
    await controller?.addTagToScreenshots(tag.id, ids);
  }

  async function bulkRemoveTag(tag: MediaTag) {
    const ids = [...selectedIds];
    const controller = deps.getTagController();
    await controller?.removeTagFromScreenshots(tag.id, ids);
  }

  return {
    get selectionMode() {
      return selectionMode;
    },
    get selectedIds() {
      return selectedIds;
    },

    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    bulkApplyTag,
    bulkRemoveTag,
  };
}

export type GallerySelectionState = ReturnType<
  typeof createGallerySelectionState
>;
