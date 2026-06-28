/**
 * Shop shared-element morph coordinator.
 *
 * The product cover morphs from its grid-card footprint into the detail-page hero
 * (and back) as ONE element, with interruptible, velocity-carrying spring physics
 * (Motion). The View Transitions API can't do this — it's a fixed-duration,
 * non-interruptible snapshot crossfade that also no-ops on Safari/Firefox. A
 * transform-FLIP morph on a ghost overlay is the 2026 best-practice path: it's
 * compositor-friendly (WAAPI), interruptible, and works on every browser.
 *
 * The hard part is the SvelteKit route change: the grid (/shop) and detail
 * (/shop/[id]) are separate route components, so the cover unmounts on
 * navigation. This module bridges that:
 *
 *   1. Every participating cover (CardMockupPreview with a morphId) registers its
 *      live element here on mount, keyed by product id.
 *   2. At navigation start (a card click, or the detail's back button) the click
 *      site calls captureMorphSource(id) — we snapshot the currently-mounted
 *      cover's rect + visual.
 *   3. When the DESTINATION cover mounts, it calls startMorphInto(id, el). If a
 *      source was captured for that product, we hide the real cover and ask the
 *      registered ghost runner (ShopMorphLayer) to fly a ghost from the source
 *      rect to this cover's rect, revealing the real cover when it lands.
 *
 * Reduced motion: captureMorphSource is a no-op, so no ghost ever runs and the
 * destination cover shows immediately.
 */

export interface MorphVisual {
  coverImageUrl?: string;
  productName: string;
}

export interface MorphRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Runs the actual ghost animation. Registered by ShopMorphLayer on mount. */
export type MorphRunner = (
  from: MorphRect,
  to: MorphRect,
  visual: MorphVisual,
  onDone: () => void
) => void;

interface CoverReg extends MorphVisual {
  el: HTMLElement;
}

interface Pending {
  productId: string;
  rect: MorphRect;
  visual: MorphVisual;
}

// Live, currently-mounted cover elements keyed by product id.
const covers = new Map<string, CoverReg>();

// Source snapshot captured at navigation start, consumed by the destination cover.
let pending: Pending | null = null;

// The overlay's ghost runner.
let runner: MorphRunner | null = null;

// Honor prefers-reduced-motion (Motion does NOT auto-respect it).
let reducedMotion = false;
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotion = mq.matches;
  mq.addEventListener?.("change", (e) => {
    reducedMotion = e.matches;
  });
}

function toRect(el: HTMLElement): MorphRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function registerCover(id: string, el: HTMLElement, visual: MorphVisual): void {
  covers.set(id, { el, ...visual });
}

export function unregisterCover(id: string, el: HTMLElement): void {
  if (covers.get(id)?.el === el) covers.delete(id);
}

export function setMorphRunner(fn: MorphRunner | null): void {
  runner = fn;
}

/**
 * Snapshot the currently-mounted cover for this product so the destination can
 * morph from it. Call this synchronously at navigation start (click), before the
 * source cover unmounts. No-op (and clears any stale pending) under reduced motion
 * or when the cover isn't registered.
 */
export function captureMorphSource(productId: string): void {
  if (reducedMotion || !runner) {
    pending = null;
    return;
  }
  const reg = covers.get(productId);
  if (!reg) {
    pending = null;
    return;
  }
  pending = {
    productId,
    rect: toRect(reg.el),
    visual: { coverImageUrl: reg.coverImageUrl, productName: reg.productName },
  };
}

/**
 * Called by a destination cover on mount. If a source was captured for this
 * product, hides the real cover and runs the ghost morph from the source rect to
 * this cover's rect, revealing the cover when the morph lands. Returns true if a
 * morph started.
 */
export function startMorphInto(id: string, targetEl: HTMLElement): boolean {
  // Do NOT clear pending on a mismatch. The grid mounts EVERY product's cover, so a
  // non-matching cover mounting first must not wipe the pending source before the
  // real target cover mounts — that is exactly why the reverse (detail -> grid)
  // morph silently no-op'd while the forward one worked (the detail page mounts
  // only one cover, so it always matched).
  if (!pending || pending.productId !== id || !runner) {
    return false;
  }
  const from = pending.rect;
  const visual = pending.visual;
  pending = null;

  const to = toRect(targetEl);
  // Guard against a zero-size target (not laid out yet) — skip rather than morph
  // into a collapsed box.
  if (to.width < 1 || to.height < 1) return false;

  targetEl.style.opacity = "0";
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    targetEl.style.opacity = "";
  };
  runner(from, to, visual, reveal);
  return true;
}
