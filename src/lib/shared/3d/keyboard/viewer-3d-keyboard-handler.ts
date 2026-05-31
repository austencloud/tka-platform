/**
 * Viewer 3D Keyboard Handler
 *
 * Binds Ctrl+Z / Ctrl+Shift+Z (Cmd on macOS) to the viewer's undo/redo
 * when the gear popover is open and the user is not typing in a text input.
 *
 * Returns a disposer that unregisters the listener. Call once per popover
 * mount; dispose on unmount.
 */

interface Viewer3DKeyboardTarget {
  undo(): void;
  redo(): void;
}

/**
 * Test whether the event target is an editable element. Ctrl+Z inside a
 * text input should go to the input's own undo stack, not the viewer's.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function createViewer3DKeyboardHandler(target: Viewer3DKeyboardTarget): () => void {
  function onKeyDown(e: KeyboardEvent): void {
    // Only respond to Ctrl/Cmd + Z (with or without Shift).
    const meta = e.ctrlKey || e.metaKey;
    if (!meta) return;
    if (e.key !== "z" && e.key !== "Z") return;

    // Don't steal focus from text inputs.
    if (isEditableTarget(e.target)) return;

    e.preventDefault();
    if (e.shiftKey) {
      target.redo();
    } else {
      target.undo();
    }
  }

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
