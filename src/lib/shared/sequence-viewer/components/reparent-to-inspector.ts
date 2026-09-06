import { createLayoutMotion } from "$lib/shared/transitions/layout-flip";
import { motionDuration } from "$lib/shared/transitions/motion";
import { DURATION } from "$lib/shared/transitions/transitions";

export interface ReparentOptions {
  target: HTMLElement | null;
  animate?: boolean;
  /** Move the mounted host, but measure/animate its visual surface independently
   * when sibling chrome (such as a loaned transport) changes its allocation. */
  visualSelector?: string;
  onMoving?: (moving: boolean) => void;
}
type ReparentTarget = HTMLElement | null | ReparentOptions;

interface ReparentAction {
  capture(): void;
  update(target: ReparentTarget): void;
  destroy(): void;
}

/**
 * Moves one already-mounted settings surface into the viewer's inspector slot.
 * Restoring the original position keeps the same component usable in standalone
 * art hosts and when a responsive layout changes back to the bottom dock.
 */
export function reparentToInspector(
  node: HTMLElement,
  target: ReparentTarget
): ReparentAction {
  const origin = node.parentNode;
  const originNextSibling = node.nextSibling;
  const key = `handoff-${crypto.randomUUID()}`;
  node.dataset.surfaceHandoff = key;
  const initialOptions =
    target && !(target instanceof HTMLElement) ? target : null;
  const visualSelector = initialOptions?.visualSelector;
  const motion = createLayoutMotion({
    getRoot: () => node.ownerDocument.body,
    groups: [
      {
        selector: `[data-surface-handoff="${key}"]${visualSelector ? ` ${visualSelector}` : ""}`,
        datasetKey: "surfaceHandoff",
      },
    ],
    getDuration: () => motionDuration(DURATION.emphasis),
  });
  let version = 0;
  let savedStyle: string | null | undefined;
  let destination: HTMLElement | null = null;
  let movingCallback: ReparentOptions["onMoving"];
  let trackingFrame = 0;

  function restoreStyle(): void {
    delete node.dataset.surfaceFlight;
    if (savedStyle === undefined) return;
    if (savedStyle === null) node.removeAttribute("style");
    else node.setAttribute("style", savedStyle);
    savedStyle = undefined;
  }

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

  function update(value: ReparentTarget): void {
    const options =
      value && !(value instanceof HTMLElement) ? value : { target: value };
    const next = options.target;
    if (next === destination && savedStyle !== undefined) return;
    if (next === destination && node.parentNode === (next ?? origin)) return;
    destination = next;
    const ticket = ++version;
    cancelAnimationFrame(trackingFrame);
    movingCallback?.(false);
    movingCallback = options.onMoving;
    const before = node.getBoundingClientRect();
    const animate =
      options.animate &&
      node.isConnected &&
      before.width > 0 &&
      before.height > 0 &&
      motionDuration(DURATION.emphasis) > 0;
    const captured = animate && (motion.hasCapture || motion.capture());
    if (!captured) motion.cancel();
    restoreStyle();
    move(next);
    const rect = node.getBoundingClientRect();
    if (!captured || rect.width < 1 || rect.height < 1) {
      motion.discard();
      return;
    }

    // The live surface travels above both clipping hosts. It is never cloned:
    // the renderer keeps drawing while the surrounding workspace rearranges.
    savedStyle = node.getAttribute("style");
    const host = next ?? (origin instanceof HTMLElement ? origin : null);
    const hostRect = host?.getBoundingClientRect();
    node.ownerDocument.body.appendChild(node);
    node.dataset.surfaceFlight = "true";
    Object.assign(node.style, {
      position: "fixed",
      inset: "auto",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: "0",
      maxWidth: "none",
      maxHeight: "none",
      zIndex: "1000",
      pointerEvents: "none",
    });
    movingCallback?.(true);
    const animations = motion.play();
    // The inspector track is closing while the phone arrives. Follow that
    // destination during the flight so docking cannot add a final side-step.
    const track = () => {
      if (ticket !== version || !host || !hostRect) return;
      const current = host.getBoundingClientRect();
      if (current.width > 0 && current.height > 0) {
        node.style.left = `${rect.left + current.left - hostRect.left}px`;
        node.style.top = `${rect.top + current.top - hostRect.top}px`;
        node.style.width = `${Math.max(1, rect.width + current.width - hostRect.width)}px`;
        node.style.height = `${Math.max(1, rect.height + current.height - hostRect.height)}px`;
      }
      trackingFrame = requestAnimationFrame(track);
    };
    trackingFrame = requestAnimationFrame(track);
    const settle = () => {
      if (ticket !== version) return;
      cancelAnimationFrame(trackingFrame);
      restoreStyle();
      move(destination);
      movingCallback?.(false);
    };
    if (animations.length === 0) settle();
    else
      void Promise.all(
        animations.map((animation) => animation.finished.catch(() => undefined))
      ).then(settle);
  }

  update(target);
  return {
    capture: () => {
      motion.capture();
    },
    update,
    destroy: () => {
      ++version;
      cancelAnimationFrame(trackingFrame);
      motion.cancel();
      restoreStyle();
      // Svelte may already have removed the owning block before action cleanup.
      // Restoring a detached node here would resurrect a dead canvas over the
      // replacement. A still-loaned node does need to leave its external host.
      if (node.parentNode) move(null);
      movingCallback?.(false);
      delete node.dataset.surfaceHandoff;
    },
  };
}
