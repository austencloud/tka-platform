import {
  isShortcutTargetEnabled,
  resolveShortcutTarget,
} from "./shortcut-target-resolution";

export type EditHistoryAction = "undo" | "redo";

interface EditHistoryResolutionOptions {
  fromCommandPalette?: boolean;
}

const COMMAND_PALETTE_LAYER_SELECTOR = "dialog.command-palette-modal";

function targetSelector(action: EditHistoryAction): string {
  return `button[data-${action}-shortcut]`;
}

function resolveTarget(
  action: EditHistoryAction,
  document: Document,
  options: EditHistoryResolutionOptions
): HTMLButtonElement | null {
  return resolveShortcutTarget<HTMLButtonElement>(document, {
    targetSelector: targetSelector(action),
    scopeSelector: "[data-edit-history-shortcut-scope]",
    ignoreEditableFocus: !options.fromCommandPalette,
    // A host may contain more than one history owner: the Stage embeds the 3D
    // scene rail, which brings its own bridge. Undo belongs to whichever of
    // them actually has something to undo.
    preferEnabled: true,
    excludedLayerSelector: options.fromCommandPalette
      ? COMMAND_PALETTE_LAYER_SELECTOR
      : undefined,
  });
}

export function resolveEditHistoryShortcutTarget(
  action: EditHistoryAction,
  document: Document = globalThis.document
): HTMLButtonElement | null {
  return resolveTarget(action, document, {});
}

export function hasEditHistoryShortcutTarget(
  action: EditHistoryAction,
  document: Document = globalThis.document
): boolean {
  return resolveEditHistoryShortcutTarget(action, document) !== null;
}

export function canActivateEditHistoryShortcutTarget(
  action: EditHistoryAction,
  document: Document = globalThis.document,
  options: EditHistoryResolutionOptions = {}
): boolean {
  const target = resolveTarget(action, document, options);
  return target !== null && isShortcutTargetEnabled(target);
}

export function activateEditHistoryShortcutTarget(
  action: EditHistoryAction,
  document: Document = globalThis.document,
  options: EditHistoryResolutionOptions = {}
): boolean {
  const target = resolveTarget(action, document, options);
  if (!target) return false;

  if (isShortcutTargetEnabled(target)) target.click();
  return true;
}

export function getEditHistoryShortcutActionLabel(
  action: EditHistoryAction,
  document: Document = globalThis.document,
  options: EditHistoryResolutionOptions = {}
): string | null {
  const target = resolveTarget(action, document, options);
  if (!target) return null;

  const explicit = target.getAttribute(`data-${action}-shortcut-label`)?.trim();
  if (explicit) return explicit;

  const fallback =
    target.getAttribute("aria-label")?.trim() ||
    target.getAttribute("title")?.trim();
  if (!fallback) return null;

  const withoutShortcut = fallback.replace(
    /\s*\((?:ctrl|cmd|command|⌘)[^)]*\)\s*$/i,
    ""
  );
  const withoutAction = withoutShortcut
    .replace(new RegExp(`^${action}(?:\\s*:\\s*|\\s+)`, "i"), "")
    .trim();

  if (
    !withoutAction ||
    withoutAction.toLowerCase() === "last action" ||
    withoutAction.toLowerCase().startsWith("nothing to ") ||
    withoutAction.toLowerCase().startsWith("no actions to ")
  ) {
    return null;
  }

  return withoutAction.charAt(0).toUpperCase() + withoutAction.slice(1);
}
