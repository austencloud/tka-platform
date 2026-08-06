/**
 * DOM contract for the app-wide Save shortcut.
 *
 * A surface opts in by placing `data-save-shortcut` on the same native button
 * that its visible Save control uses. Ctrl/Cmd+S then clicks that button, so the
 * shortcut and pointer paths share validation, progress, errors, and feedback.
 */

import {
  isShortcutTargetEnabled,
  resolveShortcutTarget,
} from "./shortcut-target-resolution";

const SAVE_TARGET_SELECTOR = "button[data-save-shortcut]";

/**
 * Returns the Save button owned by the active UI surface.
 *
 * Open modal layers block background targets. Within one surface, the target
 * nearest keyboard focus wins, which lets independent inline editors coexist.
 */
export function resolveSaveShortcutTarget(
  document: Document = globalThis.document
): HTMLButtonElement | null {
  return resolveShortcutTarget<HTMLButtonElement>(document, {
    targetSelector: SAVE_TARGET_SELECTOR,
    scopeSelector: "[data-save-shortcut-scope]",
  });
}

export function hasSaveShortcutTarget(
  document: Document = globalThis.document
): boolean {
  return resolveSaveShortcutTarget(document) !== null;
}

export function activateSaveShortcutTarget(
  document: Document = globalThis.document
): boolean {
  const target = resolveSaveShortcutTarget(document);
  if (!target) return false;

  if (isShortcutTargetEnabled(target)) {
    target.click();
  }

  return true;
}
