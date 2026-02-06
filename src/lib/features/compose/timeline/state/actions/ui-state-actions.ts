/**
 * UI State Actions
 *
 * Extracted UI panel state mutations (inspector, settings dialogs).
 * Uses callback injection to preserve Svelte 5 reactivity.
 */

export interface UIStateContext {
  getClipBeingEdited: () => string | null;
  setClipBeingEdited: (id: string | null) => void;
  getIsClipInspectorOpen: () => boolean;
  setIsClipInspectorOpen: (open: boolean) => void;
  getIsTrackSettingsOpen: () => boolean;
  setIsTrackSettingsOpen: (open: boolean) => void;
  getIsProjectSettingsOpen: () => boolean;
  setIsProjectSettingsOpen: (open: boolean) => void;
  selectClip: (clipId: string) => void;
}

export function createUIStateActions(ctx: UIStateContext) {
  function openClipInspector(clipId: string) {
    ctx.setClipBeingEdited(clipId);
    ctx.setIsClipInspectorOpen(true);
    ctx.selectClip(clipId);
  }

  function closeClipInspector() {
    ctx.setIsClipInspectorOpen(false);
    ctx.setClipBeingEdited(null);
  }

  function openTrackSettings() {
    ctx.setIsTrackSettingsOpen(true);
  }

  function closeTrackSettings() {
    ctx.setIsTrackSettingsOpen(false);
  }

  function openProjectSettings() {
    ctx.setIsProjectSettingsOpen(true);
  }

  function closeProjectSettings() {
    ctx.setIsProjectSettingsOpen(false);
  }

  return {
    openClipInspector,
    closeClipInspector,
    openTrackSettings,
    closeTrackSettings,
    openProjectSettings,
    closeProjectSettings,
  };
}
