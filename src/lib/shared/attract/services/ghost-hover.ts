/**
 * Move the Ghost's synthetic hover from one element to another.
 *
 * Most controls only need `.ghost-hover` so their real hover styling can be
 * mirrored in CSS. Some composite controls also change state when the pointer
 * crosses their outer edge. A `.ghost-hover-boundary` opts into those real
 * pointer-enter/leave semantics, which is how the collapsed desktop sidebar
 * opens before the Ghost can read it.
 */

const HOVER_CLASS = "ghost-hover";
const BOUNDARY_SELECTOR = ".ghost-hover-boundary";

function boundaryFor(el: HTMLElement | null): HTMLElement | null {
  return el?.closest<HTMLElement>(BOUNDARY_SELECTOR) ?? null;
}

function pointerBoundaryEvent(type: "pointerenter" | "pointerleave"): Event {
  if (typeof PointerEvent === "function") {
    return new PointerEvent(type, {
      bubbles: false,
      clientX: type === "pointerleave" ? -1 : 1,
      clientY: type === "pointerleave" ? -1 : 1,
    });
  }
  return new Event(type, { bubbles: false });
}

export function transitionGhostHover(
  previous: HTMLElement | null,
  next: HTMLElement | null
): void {
  if (previous === next) return;

  const previousBoundary = boundaryFor(previous);
  const nextBoundary = boundaryFor(next);

  previous?.classList.remove(HOVER_CLASS);
  next?.classList.add(HOVER_CLASS);

  if (previousBoundary !== nextBoundary) {
    previousBoundary?.dispatchEvent(pointerBoundaryEvent("pointerleave"));
    nextBoundary?.dispatchEvent(pointerBoundaryEvent("pointerenter"));
  }
}
