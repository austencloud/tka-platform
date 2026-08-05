/**
 * The mind — score, pick, perform, remember, repeat
 * (spec: docs/superpowers/specs/2026-08-04-ghost-mind-design.md §Architecture).
 *
 * This is the entire brain and it is about a hundred lines on purpose. The
 * scoring itself lives in domain/scoring.ts (pure, tested); what is here is the
 * loop, the session memory, and the reactive thought the caption renders.
 *
 * The loop is handed to the attract-ghost core's run() as its cycle, so it
 * inherits park/resume, the viewport gate, and the "a transient DOM race must
 * never silently kill the loop" recovery for free.
 */

import type { AttractGhost } from "./attract-ghost.svelte";
import { createRng, type Rng } from "./rng";
import { createTrail, type Trail } from "./trail";
import {
  resolveThought,
  type GhostContext,
  type GhostMemory,
  type GhostMood,
  type GhostWorld,
  type Intention,
} from "../domain/intention";
import {
  createMemory,
  decayFatigue,
  remember,
  selectIntention,
} from "../domain/scoring";

/** How long a thought stays legible before another can replace it. */
const MIN_THOUGHT_MS = 1800;
/** Breath between intentions. Jittered — a metronome reads as a machine. */
const BETWEEN_MS = 700;

export interface GhostMind {
  /** The visible monologue. Null before the first decision. */
  readonly thought: string | null;
  readonly mood: GhostMood;
  readonly seed: number;
  readonly memory: GhostMemory;
  readonly trail: Trail;
  /** One decision. The cycle handed to the core's run(). */
  tick: () => Promise<void>;
}

export function createGhostMind(opts: {
  intentions: readonly Intention[];
  ghost: AttractGhost;
  /** Reads live app state off the DOM. Called once per tick. */
  sense: () => GhostWorld;
  /** Fixed seed for a reproducible tour. Logged at start when omitted. */
  seed?: number;
  rng?: Rng;
  now?: () => number;
}): GhostMind {
  const now = opts.now ?? (() => performance.now());
  const rng = opts.rng ?? createRng(opts.seed);
  const trail = createTrail(now);
  const memory = createMemory(rng, trail);

  const state = $state<{ thought: string | null; mood: GhostMood }>({
    thought: null,
    mood: "curious",
  });

  let thoughtSetAt = 0;
  let currentModuleId: string | null = null;
  let moduleEnteredAt = now();

  function readContext(): GhostContext {
    const world = opts.sense();
    if (world.moduleId !== currentModuleId) {
      currentModuleId = world.moduleId;
      moduleEnteredAt = now();
      if (world.moduleId) memory.visitedModules.add(world.moduleId);
    }
    memory.moduleDwellMs = now() - moduleEnteredAt;
    return { ...world, ...memory };
  }

  async function think(text: string, mood: GhostMood): Promise<void> {
    // A thought the visitor could not finish reading is worse than no thought.
    const held = now() - thoughtSetAt;
    if (state.thought !== null && held < MIN_THOUGHT_MS) {
      await opts.ghost.sleep(MIN_THOUGHT_MS - held);
    }
    state.thought = text;
    state.mood = mood;
    thoughtSetAt = now();
  }

  async function tick(): Promise<void> {
    const g = opts.ghost;
    if (g.halted()) return;

    decayFatigue(memory);
    const ctx = readContext();
    const intention = selectIntention(opts.intentions, ctx);

    if (!intention) {
      // Nothing satisfiable here — usually a view still loading. Wait rather
      // than spin, and let the next tick re-sense.
      await g.sleep(1200);
      return;
    }

    // Pick the target BEFORE speaking, so the thought and the action are about
    // the same control. An intention that declares a target and cannot find one
    // is not satisfiable this tick, however optimistic its `can` was.
    let target: HTMLElement | null = null;
    if (intention.target) {
      try {
        target = intention.target(ctx);
      } catch {
        target = null;
      }
      if (!target) {
        await g.sleep(400);
        return;
      }
    }

    const thought = resolveThought(intention, ctx, target);
    await think(thought, intention.mood ?? "curious");
    if (g.halted()) return;

    let ok = true;
    try {
      ok = (await intention.perform(g, ctx, target)) !== false;
    } catch {
      // A perform that throws is a lying precondition with extra steps. The
      // trail records it; the tour carries on.
      ok = false;
    }

    remember(memory, intention);
    // A drastic move earns the room a fresh start. Without this, an escape that
    // lands in the module it was ALREADY in leaves moduleDwellMs untouched — so
    // the 45s stuck-gate stays open and the ghost re-escapes on every tick,
    // narrating "let's go back" forever. Observed on a clean profile, where a
    // first-run modal made every room look empty.
    if (ok && intention.category === "reset") {
      moduleEnteredAt = now();
      memory.moduleDwellMs = 0;
    }
    trail.push({
      intentionId: intention.id,
      thought,
      moduleId: ctx.moduleId,
      ok,
    });

    // A failed perform means the ghost reached for nothing. Pause a beat
    // longer so a run of misses doesn't look like a seizure.
    await g.sleep(g.jitter(ok ? BETWEEN_MS : 1600, 600));
  }

  return {
    get thought() {
      return state.thought;
    },
    get mood() {
      return state.mood;
    },
    seed: rng.seed,
    memory,
    trail,
    tick,
  };
}
