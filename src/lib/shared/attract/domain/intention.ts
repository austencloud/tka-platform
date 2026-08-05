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
  | "reset";

export const INTENTION_CATEGORIES: IntentionCategory[] = [
  "build",
  "playback",
  "effects",
  "props",
  "explore",
  "admire",
  "reset",
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
  };
  rng: Rng;
  trail: Trail;
}

export type GhostContext = GhostWorld & GhostMemory;

export interface Intention {
  id: string;
  category: IntentionCategory;

  /** The visible monologue. A function when it names what it found. */
  thought: string | ((ctx: GhostContext) => string);

  /** Hard gate. False means it is not even a candidate this tick. */
  can: (ctx: GhostContext) => boolean;

  /** Appeal right now, 0..1, BEFORE novelty and fatigue are applied. */
  appeal: (ctx: GhostContext) => number;

  /**
   * The choreography, written against the existing motor primitives.
   * Return false when it found nothing to act on — that is a lying
   * precondition and the trail records it. void counts as acted.
   */
  perform: (g: AttractGhost, ctx: GhostContext) => Promise<boolean | void>;

  /** Optional mood hint for the body. Defaults to "curious". */
  mood?: GhostMood;
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
};

export function resolveThought(intention: Intention, ctx: GhostContext): string {
  return typeof intention.thought === "function"
    ? intention.thought(ctx)
    : intention.thought;
}
