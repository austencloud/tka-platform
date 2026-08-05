/**
 * The Intention — one small curiosity the ghost can have
 * (spec: docs/superpowers/specs/2026-08-04-ghost-mind-design.md §The Intention).
 *
 * The intention SEQUENCE is never authored. Each intention only knows whether
 * it is currently possible, how appealing it is right now, what it is thinking,
 * and how to act itself out. The mind loop does the rest, which is what buys
 * hand-choreographed quality per action AND emergent breadth across the app.
 */

import type { AttractGhost } from "../services/attract-ghost.svelte";
import type { Rng } from "../services/rng";
import type { Trail } from "../services/trail";

export type IntentionCategory =
  | "build"
  | "playback"
  | "effects"
  | "props"
  | "explore"
  | "admire"
  | "reset"
  | "invite";

export const INTENTION_CATEGORIES: IntentionCategory[] = [
  "build",
  "playback",
  "effects",
  "props",
  "explore",
  "admire",
  "reset",
  "invite",
];

/** Mood hint for the body (companion spec: Taco Cat). The dot ignores it. */
export type GhostMood = "curious" | "delighted" | "bored" | "unsure" | "still";

/** What the sensors read off the live DOM every tick. Never feature imports. */
export interface GhostWorld {
  moduleId: string | null;
  tabId: string | null;
  hasSequence: boolean;
  sequenceLength: number;
  /** The sequence's word, already routed through simplifyRepeatedWord. */
  sequenceWord: string | null;
  isPlaying: boolean;
  activeEffectIds: string[];
  viewerOpen: boolean;
  pickerOpen: boolean;
  /** Modules the ghost can actually reach from the nav right now. */
  reachableModules: string[];
  /**
   * How many pressable, actually-visible elements of each annotated kind are
   * on screen. Every `can` is written against this, so a precondition can only
   * be true when the thing it wants to touch is really there — which is the
   * one failure mode that makes the ghost look broken.
   */
  available: Record<GhostKind_, number>;
  /** Elements inviting the ghost to sit and watch. */
  lingerCount: number;
  /**
   * The camera permission is ALREADY granted for this origin, so entering
   * practice will show a mirror instead of raising a native permission prompt.
   * Fails closed: false on any browser that will not answer the question
   * (Safari does not implement the camera permission query), because a prompt
   * the ghost cannot see, press or dismiss is a dead stop in front of
   * strangers.
   */
  cameraGranted: boolean;
  /**
   * A module is currently putting on the show itself — the museum docent walking
   * the player around. The ghost stands back, and the escape hatch must not fire
   * just because an immersive module has nothing left to press: a tour in progress
   * is the opposite of being stuck.
   */
  presenting: boolean;
  /**
   * The camera stream is actually live and attached — not merely that the mirror
   * was switched on. "Wait — can it see me?" must never appear over a black
   * rectangle or a failed permission.
   */
  cameraLive: boolean;
}

/** Re-exported for the world's `available` map without a circular import. */
type GhostKind_ = import("./annotations").GhostKind;

/** A world where nothing is possible. Every `can` must be false against it. */
export const EMPTY_WORLD: GhostWorld = {
  moduleId: null,
  tabId: null,
  hasSequence: false,
  sequenceLength: 0,
  sequenceWord: null,
  isPlaying: false,
  activeEffectIds: [],
  viewerOpen: false,
  pickerOpen: false,
  reachableModules: [],
  available: {
    "start-position": 0,
    option: 0,
    "option-filter": 0,
    turn: 0,
    "step-cell": 0,
    clear: 0,
    confirm: 0,
    dismiss: 0,
    "close-overlay": 0,
    practice: 0,
    mirror: 0,
    "practice-stop": 0,
    docent: 0,
    play: 0,
    stage: 0,
    tempo: 0,
    effect: 0,
    "effect-param": 0,
    prop: 0,
    "prop-picker": 0,
    "nav-module": 0,
    "nav-tab": 0,
    viewer: 0,
    "gallery-item": 0,
    curio: 0,
  },
  lingerCount: 0,
  cameraGranted: false,
  presenting: false,
  cameraLive: false,
};

/** What the mind remembers for the session. Survives takeover/resume. */
export interface GhostMemory {
  /** intentionId -> times performed this session. */
  performed: Map<string, number>;
  visitedModules: Set<string>;
  lastCategory: IntentionCategory | null;
  /** category -> 0..1, rises on performance, decays every tick. */
  fatigue: Map<IntentionCategory, number>;
  /** ms spent in the current module. Rising pressure to move on. */
  moduleDwellMs: number;
  /**
   * Controls the ghost has already asked "what does this do?" about, so it asks
   * about a new one next time. Lives here rather than in the intention module so
   * the whole of what a tour remembers is seeded, inspectable via
   * `window.__ghost.memory`, and reset with the mind rather than with an HMR
   * reload.
   */
  askedAbout: Set<string>;
  /**
   * Per-session budgets an intention spends. An OBJECT, not loose numbers: the
   * context handed to `perform` is a shallow copy of world + memory, so a
   * scalar written through the context would be dropped on the floor. Anything
   * an intention needs to increment has to live behind a reference.
   */
  budgets: {
    /** Gallery opens so far. Firestore reads cost money over a four-hour jam. */
    galleryOpens: number;
    /**
     * Invitations offered so far. "You can take this from me" is worth saying
     * and worth saying rarely: the whole point is that it reads as an aside
     * from something busy, not as signage. Capped per session and spaced.
     */
    invites: number;
    /**
     * `trail.lastAt()` when the last invitation ran, for the spacing half of
     * that budget. Lives INSIDE budgets for the reason documented above: the
     * context handed to `perform` is a shallow copy, so a bare scalar on memory
     * would be written to a throwaway object and silently lost.
     */
    lastInviteAt: number;
  };
  rng: Rng;
  trail: Trail;
}

export type GhostContext = GhostWorld & GhostMemory;

export interface Intention {
  id: string;
  category: IntentionCategory;

  /**
   * Choose the ONE element this intention will act on, before it says anything.
   *
   * Without this, a thought that names a control and a perform that picks one
   * sample the DOM independently and disagree — the thought took the first
   * fresh match, the perform took a random one. Austen watching it live:
   * "he keeps saying I wonder what side by side is and then not clicking side
   * by side", "said I wanted to slow down and then clicked fast". A presenter
   * that narrates one thing and does another is worse than a silent one.
   *
   * The target is resolved once, the thought is written from it, and the
   * perform acts on exactly it. If it has vanished by then the perform fails
   * honestly rather than quietly substituting a different control.
   */
  target?: (ctx: GhostContext) => HTMLElement | null;

  /** The visible monologue. A function when it names what it is about to touch. */
  thought:
    | string
    | ((ctx: GhostContext, target: HTMLElement | null) => string);

  /** Hard gate. False means it is not even a candidate this tick. */
  can: (ctx: GhostContext) => boolean;

  /** Appeal right now, 0..1, BEFORE novelty and fatigue are applied. */
  appeal: (ctx: GhostContext) => number;

  /**
   * The choreography, written against the existing motor primitives.
   * Return false when it found nothing to act on — that is a lying
   * precondition and the trail records it. void counts as acted.
   */
  perform: (
    g: AttractGhost,
    ctx: GhostContext,
    target: HTMLElement | null,
  ) => Promise<boolean | void>;

  /**
   * Said AFTER the press, once the thing has actually happened. "OK, that was
   * kind of neat" is a reaction, not a motive — it only makes sense on the way
   * out, and the thought slot before the press cannot carry it. Return null to
   * stay quiet, which should be most of the time.
   */
  reaction?: (ctx: GhostContext, target: HTMLElement | null) => string | null;

  /** Optional mood hint for the body. Defaults to "curious". */
  mood?: GhostMood;

  /**
   * Milliseconds to step back and SHUT UP after a successful perform, so the
   * thing that just happened can actually be watched.
   *
   * Declare it only on beats with a real payoff — a sequence playing, an effect
   * lighting up. The ghost glides clear, shrinks, dims, and the caption blanks
   * for this long; then the `reaction` lands on the way back in. That is what
   * gives the show peaks instead of an unbroken stream of clicking.
   *
   * Deliberately opt-in per intention. The global version of this behaviour was
   * a bug (3b912bbc97 — "moves out of the way after clicking"): stepping aside
   * when there is nothing to look at is just the ghost wandering off.
   */
  savor?: number | ((ctx: GhostContext) => number);
}

/**
 * Natural successors. Momentum is what turns a scored bag into a chain of
 * thought: "make a thing, watch it, dress it up" becomes the LIKELY path
 * without that sequence ever being written down anywhere.
 */
export const FOLLOWS: Record<IntentionCategory, IntentionCategory[]> = {
  build: ["build", "playback"],
  playback: ["effects", "props", "playback", "admire"],
  effects: ["effects", "playback", "admire"],
  props: ["playback", "effects", "admire"],
  explore: ["explore", "build", "admire"],
  admire: ["explore", "playback"],
  reset: ["build"],
  // Nothing follows INTO an invitation: it must win on its own low appeal, never
  // on momentum, or two of them chain and the aside becomes a pitch.
  invite: ["build", "explore", "playback"],
};

export function resolveThought(
  intention: Intention,
  ctx: GhostContext,
  target: HTMLElement | null = null,
): string {
  return typeof intention.thought === "function"
    ? intention.thought(ctx, target)
    : intention.thought;
}
