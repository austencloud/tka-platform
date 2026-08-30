interface ReparentAction {
  update(target: HTMLElement | null): void;
  destroy(): void;
}

/**
 * Moves one already-mounted settings surface into the viewer's inspector slot.
 * Restoring the original position keeps the same component usable in standalone
 * art hosts and when a responsive layout changes back to the bottom dock.
 */
export function reparentToInspector(
  node: HTMLElement,
  target: HTMLElement | null
): ReparentAction {
  const origin = node.parentNode;
  const originNextSibling = node.nextSibling;

  function move(nextTarget: HTMLElement | null): void {
    if (nextTarget) {
      if (node.parentNode !== nextTarget) nextTarget.appendChild(node);
      return;
    }

    if (!origin || node.parentNode === origin) return;
    if (originNextSibling?.parentNode === origin) {
      origin.insertBefore(node, originNextSibling);
    } else {
      origin.appendChild(node);
    }
  }

  move(target);
  return {
    update: move,
    destroy: () => move(null),
  };
}
