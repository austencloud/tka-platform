/**
 * Untransformed layout geometry — the measurement primitive both halves of the
 * shop hero align against.
 *
 * The hero has two "put this exactly on top of that" problems: the scan band
 * belongs on the printed QR cell, and the live engine square belongs on the
 * printed mandala. Neither target is an element the hero owns, both move with
 * the card's step count and the viewport, and both sit inside a card the
 * composition rotates by ±5°.
 *
 * That rotation is why `getBoundingClientRect` is the wrong tool here: it
 * reports the axis-aligned bounding box of the ROTATED element, so a delta
 * taken between two such rects is expressed in viewport space and cannot be
 * handed back to CSS inside the rotated frame without inverting the ancestor
 * matrix first.
 *
 * `offsetLeft` / `offsetTop` / `offsetWidth` / `offsetHeight` ignore transforms
 * entirely — they are the element's box in the layout space its ancestors live
 * in, which is precisely the space a CSS offset or translate applies to. So
 * walking the offsetParent chain up to a shared root yields a rect the two
 * elements can be compared in directly, with no matrix inversion and no
 * rotation constant written down a second time.
 */

export interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * `el`'s box in `root`'s layout space, or null when `el` is not inside `root`
 * (the chain is walked through offsetParents, so `root` must be a containing
 * block — `position: relative` or a transform is enough).
 */
export function layoutRectWithin(
  el: HTMLElement,
  root: HTMLElement
): LayoutRect | null {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  // Guard against a detached or reparented node walking off the top.
  let hops = 0;
  while (node && node !== root && hops < 32) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const parent = node.offsetParent as HTMLElement | null;
    // offsetLeft is measured from the parent's padding edge and ignores how far
    // that parent is scrolled; a scrolling ancestor between here and the root
    // has to be subtracted back out.
    if (parent && parent !== root) {
      x -= parent.scrollLeft;
      y -= parent.scrollTop;
    }
    node = parent;
    hops++;
  }
  if (node !== root) return null;
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

/** Centre of `el` in `root`'s layout space. */
export function layoutCentreWithin(
  el: HTMLElement,
  root: HTMLElement
): { x: number; y: number } | null {
  const r = layoutRectWithin(el, root);
  return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null;
}

/**
 * Re-run `measure` whenever the subtree under `root` changes shape: elements
 * arriving (the fan's card box and the engine's canvas both mount late) and
 * `root` resizing (every viewport change, and the root font ramp at 4K).
 *
 * `measure` returns whether it got what it came for. The arrival watch is a
 * subtree MutationObserver, which is the right tool for "wait for a late
 * mount" and the wrong one to leave running under a 60fps animation engine —
 * so it retires on the first successful measurement, leaving the resize watch
 * to carry every later change. Returns the teardown.
 */
export function observeLayout(
  root: HTMLElement,
  measure: () => boolean
): () => void {
  let queued = 0;
  const mo = new MutationObserver(() => schedule());

  function schedule(): void {
    if (queued) return;
    // Coalesced to one measurement per frame; each one forces a layout.
    queued = requestAnimationFrame(() => {
      queued = 0;
      if (measure()) mo.disconnect();
    });
  }

  const ro = new ResizeObserver(schedule);
  ro.observe(root);
  mo.observe(root, { childList: true, subtree: true });
  schedule();

  return () => {
    ro.disconnect();
    mo.disconnect();
    if (queued) cancelAnimationFrame(queued);
  };
}
