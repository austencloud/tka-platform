/**
 * The ghost's annotation vocabulary — the whole contract between the presenter
 * and 26 modules of app (spec: 2026-08-04-ghost-mind-design.md §Safety, §Sensors).
 *
 * Default-deny: the ghost may only press an element carrying
 * `data-ghost="safe"`. Everything unannotated is invisible to it, so a control
 * added next month is safe by default. A blacklist would have the opposite
 * default and would lose.
 *
 * `data-ghost-kind` is the second half: it names the ROLE a control plays, so
 * intentions query one stable vocabulary instead of 26 modules' class names.
 * When a component is refactored the attribute travels with it, which is the
 * whole reason this is an annotation rather than a selector table in a distant
 * file.
 *
 *   <button data-ghost="safe" data-ghost-kind="option">          pressable
 *   <div data-ghost-kind="step-cell" data-ghost-index="3">       readable
 *   <div data-ghost-state="playing">                             sensed
 *   <div data-ghost-linger>                                      worth watching
 */

/** Roles the intention bag knows how to act on. */
export type GhostKind =
  // build
  | "start-position"
  | "option"
  | "option-filter"
  | "turn"
  | "step-cell"
  | "clear"
  /** The confirm button of a dialog the ghost is allowed to go through with. */
  | "confirm"
  /**
   * The way past an UNSOLICITED overlay — a first-run prompt, a tip, an
   * interstitial. Distinct from `confirm`, which finishes something the ghost
   * itself started. Any overlay with a backdrop makes every other control fail
   * the press hit-test, so a blocker it cannot dismiss ends the tour.
   */
  | "dismiss"
  // playback
  | "play"
  | "stage"
  | "tempo"
  // dress-up
  | "effect"
  /** A parameter chip inside an effect's customize panel — the dial. */
  | "effect-param"
  | "prop"
  /** Opens the prop drawer that `prop` lives in. */
  | "prop-picker"
  // explore
  | "nav-module"
  | "nav-tab"
  | "viewer"
  | "gallery-item"
  | "curio";

/**
 * Kinds supplied by something other than a TKA annotation, so the coverage test
 * cannot look for them in `src/`. Both come from @austencloud/sidebar's own
 * markup (see NAV_MODULE_SEL / NAV_TAB_SEL below).
 */
export const EXTERNALLY_PROVIDED_KINDS: readonly GhostKind[] = [
  "nav-module",
  "nav-tab",
];

/** A pressable element of this kind, visible to the allowlist. */
export const safe = (kind: GhostKind): string =>
  `[data-ghost="safe"][data-ghost-kind="${kind}"]`;

/** A readable element of this kind (not necessarily pressable). */
export const readable = (kind: GhostKind): string => `[data-ghost-kind="${kind}"]`;

/** Something the ghost is invited to just sit and watch. */
export const LINGER_SEL = "[data-ghost-linger]";

/** State the DOM could not otherwise answer, published by the component. */
export const stateSel = (state: string): string => `[data-ghost-state~="${state}"]`;

/** The simplified sequence word, published by whichever surface owns it. */
export const WORD_SEL = "[data-ghost-word]";

/** Sidebar module buttons already carry this from @austencloud/sidebar. */
export const NAV_MODULE_SEL = ".module-button[data-tour-module]";
export const NAV_MODULE_ID_ATTR = "data-tour-module";
export const NAV_TAB_SEL = ".section-button";

/**
 * Layer 2 of safety: routes the ghost hard-refuses to enter regardless of any
 * annotation it finds. Checked against the module id AND the pathname.
 */
export const DENIED_MODULES: readonly string[] = [
  "admin",
  "settings",
  "feedback",
  "shop",
  "premium",
];

export const DENIED_PATH_FRAGMENTS: readonly string[] = [
  "/admin",
  "/settings",
  "/feedback",
  "/shop",
  "/premium",
  "/checkout",
  "/profile",
];

export function isDeniedModule(moduleId: string | null | undefined): boolean {
  return !!moduleId && DENIED_MODULES.includes(moduleId);
}

export function isDeniedPath(pathname: string): boolean {
  return DENIED_PATH_FRAGMENTS.some(
    (fragment) => pathname === fragment || pathname.startsWith(`${fragment}/`),
  );
}
