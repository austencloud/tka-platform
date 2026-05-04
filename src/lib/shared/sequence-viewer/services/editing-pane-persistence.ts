const EDITING_PANE_SESSION_KEY = "tka-viewer-editing-pane";
const EDITING_PANE_TTL_MS = 2000;

export type EditingPaneValue = 'animation' | 'image' | 'video-upload';

interface PersistedEditingPane {
  pane: EditingPaneValue;
  ts: number;
  sequenceId: string | null;
}

export function loadRecentEditingPane(currentSequenceId: string | null): EditingPaneValue | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(EDITING_PANE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedEditingPane;
    const fresh = Date.now() - parsed.ts <= EDITING_PANE_TTL_MS;
    const sameSequence = parsed.sequenceId === currentSequenceId;
    if (!fresh || !sameSequence) {
      sessionStorage.removeItem(EDITING_PANE_SESSION_KEY);
      return null;
    }
    return parsed.pane ?? null;
  } catch {
    return null;
  }
}

export function persistEditingPane(pane: EditingPaneValue | null, sequenceId: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (pane === null) {
      sessionStorage.removeItem(EDITING_PANE_SESSION_KEY);
    } else {
      const payload: PersistedEditingPane = { pane, ts: Date.now(), sequenceId };
      sessionStorage.setItem(EDITING_PANE_SESSION_KEY, JSON.stringify(payload));
    }
  } catch {
    // ignore
  }
}
