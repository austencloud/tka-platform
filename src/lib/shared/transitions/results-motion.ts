/**
 * The stagger half of the results-grid filter motion system.
 *
 * `results-motion.css` owns the three phases (exit / move / enter). Everything
 * it can express in CSS lives there. The one thing it cannot express is the
 * per-card enter delay that makes the grid FILL IN rather than blink on, and
 * that is what this module adds.
 *
 * WHY NOT CSS. Two routes were considered for the stagger and one was measured
 * dead on 2026-08-05 in Chrome 151:
 *
 *  1. `animation-delay: calc(sibling-index() * 20ms)` inside
 *     `::view-transition-group(*.seq-card)`. `CSS.supports` reports
 *     `sibling-index()` as supported and the declaration parses, but every
 *     group resolved it to 1: eleven entering cards all reported
 *     `effect.getTiming().delay === 20`. The ::view-transition pseudo tree does
 *     not expose sibling positions. Route rejected on evidence, not on taste.
 *  2. Web Animations on the pseudo-element after `transition.ready`. Scripted
 *     animations sit above CSS animations in the cascade, so this cleanly
 *     re-drives the enter that `results-motion.css` set as the baseline.
 *
 * Route 2 it is. If anything here throws or the names cannot be read, the CSS
 * baseline still plays an unstaggered — but still designed — enter.
 */

/** The gallery split pane's right column. The single surface with a live
 *  results grid, and the same ancestor `results-motion.css` scopes its
 *  `view-transition-class` assignment to. Kept identical on purpose. */
const PANE = ".pane-results-body";
const CARD = `${PANE} .thumbnail-container`;

/** Enter begins after the exit has spent most of its opacity, so the phases
 *  read as separate events. Mirrors the 110ms in `results-motion.css`. */
const ENTER_DELAY_MS = 110;
const ENTER_DURATION_MS = 260;
/** Per-card step down the reading order. Small enough to feel like one gesture,
 *  large enough that the eye can follow the fill. */
const ENTER_STAGGER_MS = 22;
/** Total stagger is capped so a 40-card arrival does not turn into a
 *  second-long crawl — past this point every remaining card lands together.
 *  Set by eye at 2560 on a 22-card arrival: at 300ms the last cards were still
 *  materialising at t=330 when the rest of the grid had already settled, and
 *  the tail read as lag rather than as motion. 220ms puts the last arrival's
 *  finish at 110 + 220 + 260 = 590ms, just past the move's 320ms. */
const ENTER_STAGGER_CAP_MS = 220;
/** The design system's symmetric standard, matching `results-motion.css`.
 *  NOT `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`) despite that token being
 *  labelled "entering": it is an expo-out, and reading the frame series showed
 *  it reaching ~85% opacity by 27% of the duration — an arriving card looked
 *  like it had simply always been there, which is the exact defect this task
 *  exists to fix. */
const ENTER_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

/** Card view-transition names currently on screen, in reading (DOM) order. */
function paneCardNames(): string[] {
  if (typeof document === "undefined") return [];
  const out: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(CARD)) {
    const name = getComputedStyle(el).viewTransitionName;
    if (name && name !== "none") out.push(name);
  }
  return out;
}

/**
 * Snapshot the pane's cards BEFORE a results-changing mutation. The result is
 * the only way to tell an arriving card from a surviving one once the DOM has
 * already changed.
 */
export function captureResultsMotionState(): ReadonlySet<string> {
  return new Set(paneCardNames());
}

/**
 * After `transition.ready`, stagger the entering cards' enter animation in
 * reading order. Cards that were already on screen are left alone — their
 * motion is the group's FLIP, which must not be re-driven.
 */
export function stageResultsMotion(
  transition: ViewTransition,
  before: ReadonlySet<string>
): void {
  if (typeof document === "undefined") return;
  if (before.size === 0 && !document.querySelector(PANE)) return;

  void transition.ready
    .then(() => {
      const entering = paneCardNames().filter((name) => !before.has(name));
      if (entering.length < 2) return; // one card is not a stagger

      entering.forEach((name, index) => {
        const delay =
          ENTER_DELAY_MS +
          Math.min(index * ENTER_STAGGER_MS, ENTER_STAGGER_CAP_MS);
        try {
          document.documentElement.animate(
            [
              { opacity: 0, transform: "scale(0.92) translateY(10px)" },
              { opacity: 1, transform: "scale(1) translateY(0)" },
            ],
            {
              duration: ENTER_DURATION_MS,
              delay,
              easing: ENTER_EASING,
              fill: "backwards",
              pseudoElement: `::view-transition-new(${name})`,
            }
          );
        } catch {
          // A name the browser did not snapshot (scrolled out between capture
          // and ready) simply keeps the CSS baseline enter.
        }
      });
    })
    .catch(() => {
      // Transition skipped or superseded — nothing to stage.
    });
}
