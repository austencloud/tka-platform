/**
 * Dev-only "Illustrator mode" for the guide. When a route turns it on (it gates
 * on the `?edit` query param), pages render drag handles on their arrows and
 * text; dragging mutates the page's own $state coords live. Each editable page
 * registers a function that dumps its current coordinates, and CoordsPanel's
 * Copy button concatenates them all to the clipboard — paste the blob back and
 * the exact numbers get baked into the source. Off by default → ships clean.
 */

export const guideEdit = $state<{ on: boolean }>({ on: false });

// Each editable page registers a label → coords-dumper. Copy concatenates them.
const sources = new Map<string, () => string>();

export function registerEditSource(key: string, dump: () => string): () => void {
  sources.set(key, dump);
  return () => sources.delete(key);
}

export function collectEditCoords(): string {
  if (sources.size === 0) return "(nothing registered — open a page in edit mode)";
  return [...sources.entries()]
    .map(([k, dump]) => `=== ${k} ===\n${dump()}`)
    .join("\n\n");
}

// The sheet is 612×792 guide-points; map client px → points via the live rect of
// the nearest .guide-page so it's correct at any zoom or render scale.
function ptPerPx(node: Element): { px: number; py: number } {
  const sheet = node.closest(".guide-page");
  const r = (sheet ?? document.documentElement).getBoundingClientRect();
  return { px: 612 / r.width, py: 792 / r.height };
}

/**
 * Drag action (HTML or SVG). Reports INCREMENTAL movement in guide-points to
 * onMove(dx, dy); the caller adds it to whatever coord(s) it owns. No-op unless
 * edit mode is on.
 */
export function ptDrag(
  node: HTMLElement | SVGElement,
  params: { onMove: (dx: number, dy: number) => void }
) {
  let p = params;
  let lastX = 0;
  let lastY = 0;
  let scale = { px: 1, py: 1 };

  function move(e: PointerEvent) {
    p.onMove((e.clientX - lastX) * scale.px, (e.clientY - lastY) * scale.py);
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function up(e: PointerEvent) {
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      /* not captured */
    }
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  }
  function down(e: PointerEvent) {
    if (!guideEdit.on) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    lastX = e.clientX;
    lastY = e.clientY;
    scale = ptPerPx(node);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Cast the union node to one element type so addEventListener resolves the
  // typed (PointerEvent) overload instead of the bare EventListener fallback.
  const el = node as HTMLElement;
  el.addEventListener("pointerdown", down);
  return {
    update(next: { onMove: (dx: number, dy: number) => void }) {
      p = next;
    },
    destroy() {
      el.removeEventListener("pointerdown", down);
    },
  };
}
