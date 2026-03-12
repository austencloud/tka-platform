/**
 * Global reference to Sequence Viewer Actions
 *
 * Allows voice commands and keyboard shortcuts to trigger viewer actions
 * (export, save, share, compose) without needing Svelte context.
 *
 * Set by SequenceViewerDrawerHost when a sequence is loaded, cleared when it closes.
 */

export interface SequenceViewerActions {
  /** Enter export mode (shows export type selector) */
  enterExportMode(): void;
  /** Save sequence to library */
  save(): void;
  /** Share sequence via Web Share API or clipboard */
  share(): void;
  /** Open sequence in Compose module */
  openInCompose(): void;
  /** Whether the viewer is currently in export mode */
  isInExportMode(): boolean;
}

let viewerRef: SequenceViewerActions | null = null;

export function setSequenceViewerRef(actions: SequenceViewerActions | null): void {
  viewerRef = actions;
}

export function getSequenceViewerRef(): SequenceViewerActions | null {
  return viewerRef;
}
