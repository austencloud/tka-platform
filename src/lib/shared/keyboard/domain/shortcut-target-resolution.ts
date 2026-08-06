const ACTIVE_LAYER_SELECTOR =
  'dialog[open], [role="dialog"][aria-modal="true"]';

export interface ShortcutTargetResolutionOptions {
  targetSelector: string;
  scopeSelector?: string;
  ignoreEditableFocus?: boolean;
  excludedLayerSelector?: string;
}

function isVisible(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  if (element.closest("[hidden], [inert], [aria-hidden='true']")) return false;

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (
    style?.display === "none" ||
    style?.visibility === "hidden" ||
    style?.visibility === "collapse"
  ) {
    return false;
  }

  return element.getClientRects().length > 0;
}

function isEditableElement(element: Element | null): boolean {
  if (!element) return false;

  const editableHost = element.closest<HTMLElement>("[contenteditable]");
  if (
    editableHost &&
    editableHost.getAttribute("contenteditable")?.toLowerCase() !== "false"
  ) {
    return true;
  }

  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLSelectElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;

  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(element.type);
}

function getLayerZIndex(layer: HTMLElement): number {
  const value = layer.ownerDocument.defaultView?.getComputedStyle(layer).zIndex;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTopLayer(
  document: Document,
  excludedLayerSelector: string | undefined
): HTMLElement | null {
  const layers = Array.from(
    document.querySelectorAll<HTMLElement>(ACTIVE_LAYER_SELECTOR)
  ).filter(
    (layer) =>
      isVisible(layer) &&
      (!excludedLayerSelector || !layer.matches(excludedLayerSelector))
  );

  return layers.reduce<HTMLElement | null>((top, layer) => {
    if (!top) return layer;
    return getLayerZIndex(layer) >= getLayerZIndex(top) ? layer : top;
  }, null);
}

function getDomDistance(from: Element, to: Element): number {
  const fromPath = new Map<Element, number>();
  let current: Element | null = from;
  let distance = 0;

  while (current) {
    fromPath.set(current, distance);
    current = current.parentElement;
    distance += 1;
  }

  current = to;
  distance = 0;
  while (current) {
    const sharedDistance = fromPath.get(current);
    if (sharedDistance !== undefined) return sharedDistance + distance;
    current = current.parentElement;
    distance += 1;
  }

  return Number.MAX_SAFE_INTEGER;
}

/**
 * Finds the active target for a semantic shortcut.
 *
 * Modal layers block the page behind them. A focused editor scope blocks its
 * siblings, and the nearest target wins when several independent editors share
 * a page.
 */
export function resolveShortcutTarget<T extends HTMLElement>(
  document: Document,
  options: ShortcutTargetResolutionOptions
): T | null {
  const activeElement = document.activeElement;
  if (options.ignoreEditableFocus && isEditableElement(activeElement)) {
    return null;
  }

  const visibleTargets = Array.from(
    document.querySelectorAll<T>(options.targetSelector)
  ).filter(isVisible);

  const topLayer = getTopLayer(document, options.excludedLayerSelector);
  let candidates = topLayer
    ? visibleTargets.filter((target) => topLayer.contains(target))
    : visibleTargets;

  const focusedScope = options.scopeSelector
    ? activeElement?.closest<HTMLElement>(options.scopeSelector)
    : null;
  if (focusedScope && (!topLayer || topLayer.contains(focusedScope))) {
    candidates = candidates.filter((target) => focusedScope.contains(target));
  }

  if (candidates.length === 0) return null;
  if (!activeElement) return candidates[0] ?? null;

  return (
    candidates.reduce<T | null>((closest, candidate) => {
      if (!closest) return candidate;
      return getDomDistance(activeElement, candidate) <
        getDomDistance(activeElement, closest)
        ? candidate
        : closest;
    }, null) ?? null
  );
}

export function isShortcutTargetEnabled(target: HTMLElement): boolean {
  return !(
    (target instanceof HTMLButtonElement && target.disabled) ||
    target.getAttribute("aria-disabled") === "true"
  );
}
