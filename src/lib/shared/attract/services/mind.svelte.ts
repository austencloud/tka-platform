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

/**
 * How long a thought stays legible before another can replace it, and the
 * breath between intentions (jittered — a metronome reads as a machine).
 *
 * Both scale by `pace`. A sentence read at arm's length and the same sentence
 * read across a room are not the same task: at fifteen feet the eye has to find
 * the caption before it can start reading it, so stage mode holds every thought
 * noticeably longer and slows the whole tour down to match.
 */
const MIN_THOUGHT_MS = 1800;
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
  /** Tempo multiplier. 1 = laptop at arm's length; >1 = stage mode. */
  pace?: number;
}): GhostMind {
  const now = opts.now ?? (() => performance.now());
  const pace = opts.pace ?? 1;
  const minThoughtMs = MIN_THOUGHT_MS * pace;
  const betweenMs = BETWEEN_MS * pace;
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
    if (state.thought !== null && held < minThoughtMs) {
      await opts.ghost.sleep(minThoughtMs - held);
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

    // SAVOR. A beat that produced something to look at gets watched instead of
    // narrated over: the caption goes dark and the ghost steps aside, so for a
    // few seconds the screen is just the running sequence or the lit effect.
    // A show needs valleys or the peaks do not register.
    if (ok && intention.savor && !g.halted()) {
      const ms =
        typeof intention.savor === "function"
          ? intention.savor(ctx)
          : intention.savor;
      if (ms > 0) {
        state.thought = null;
        // Not thoughtSetAt = now(): the NEXT thought must be free to appear the
        // instant the ghost comes back. The minimum-legibility clock is about
        // one thought replacing another, and blank is not a thought.
        thoughtSetAt = 0;
        await g.savor(ms);
      }
    }

    // The reaction lands after the thing happened, and only if it happened. A
    // "that was kind of neat" over a press that found nothing would be worse
    // than silence.
    if (ok && intention.reaction && !g.halted()) {
      // FRESH context: a reaction is about what just happened, so it has to read
      // the world AFTER the press. Handing it the pre-press snapshot would make
      // "can it see me?" ask about a camera that was not live when the tick
      // started, which is exactly the state it is meant to be gated on.
      const line = intention.reaction(readContext(), target);
      if (line) await think(line, intention.mood ?? "curious");
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
    await g.sleep(g.jitter(ok ? betweenMs : 1600 * pace, 600 * pace));
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
