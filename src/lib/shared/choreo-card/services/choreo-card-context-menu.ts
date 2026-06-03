/**
 * choreo-card-context-menu.ts
 *
 * Builds the right-click context menu entries for ChoreoCard.
 * Extracted from ChoreoCard.svelte to keep menu construction logic
 * separate from the rendering component.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export interface ChoreoCardContextMenuHandlers {
  /** Force re-render: clear all caches and re-render cells */
  forceRerender: () => void;
}

/**
 * Build the context menu items for a ChoreoCard.
 * Admin-only items (save/copy/claude) are included when `isAdmin` is true.
 */
export function buildChoreoCardContextMenu(
  sequence: SequenceData,
  isAdmin: boolean,
  handlers: ChoreoCardContextMenuHandlers,
): ContextMenuEntry[] {
  const items: ContextMenuEntry[] = [];

  if (isAdmin) {
    items.push(
      {
        id: "save-image",
        label: "Save image",
        icon: "fa-download",
        async action() {
          try {
            const { toast } = await import("$lib/shared/toast/state/toast-state.svelte");
            const { DEFAULT_SHARE_OPTIONS } = await import("$lib/shared/share/domain/models/share-options");
            const { sharer } = await import(
              "$lib/shared/share/services/sharer"
            );
            await sharer.downloadImage(sequence, { ...DEFAULT_SHARE_OPTIONS, format: "PNG" });
            toast.success("Image saved");
          } catch (err) {
            console.error("Save image failed:", err);
            const { toast } = await import("$lib/shared/toast/state/toast-state.svelte");
            toast.error("Failed to save image");
          }
        },
      },
      {
        id: "copy-image",
        label: "Copy image",
        icon: "fa-copy",
        async action() {
          try {
            const { toast } = await import("$lib/shared/toast/state/toast-state.svelte");
            const { DEFAULT_SHARE_OPTIONS } = await import("$lib/shared/share/domain/models/share-options");
            const { sharer } = await import(
              "$lib/shared/share/services/sharer"
            );
            const blob = await sharer.getImageBlob(sequence, { ...DEFAULT_SHARE_OPTIONS, format: "PNG" });
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            toast.success("Image copied to clipboard");
          } catch (err) {
            console.error("Copy image failed:", err);
            const { toast } = await import("$lib/shared/toast/state/toast-state.svelte");
            toast.error("Failed to copy image");
          }
        },
      },
      {
        id: "copy-for-claude",
        label: "Copy for Claude",
        icon: "fa-robot",
        async action() {
          try {
            const { toast } = await import("$lib/shared/toast/state/toast-state.svelte");
            const { getClaudeCodeCopier } = await import("$lib/shared/browse/get-claude-code-copier");
            const copier = getClaudeCodeCopier();
            const result = await copier.copyForClaude(sequence);
            if (result.success) {
              toast.success("Copied for Claude");
            } else {
              toast.error("Failed to copy for Claude");
            }
          } catch (err) {
            console.error("Copy for Claude failed:", err);
            const { toast } = await import("$lib/shared/toast/state/toast-state.svelte");
            toast.error("Failed to copy for Claude");
          }
        },
      },
      { type: "separator" as const },
    );
  }

  items.push({
    id: "rerender",
    label: "Re-render",
    icon: "fa-sync-alt",
    action() {
      handlers.forceRerender();
    },
  });

  return items;
}
