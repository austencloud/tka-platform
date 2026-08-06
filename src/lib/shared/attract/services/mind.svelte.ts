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
  type ActiveGhostActivity,
  type GhostContext,
  type GhostMemory,
  type GhostMood,
  type GhostNavigationOption,
  type GhostWorld,
  type Intention,
  type UnderstandingStage,
} from "../domain/intention";
import {
  createMemory,
  decayFatigue,
  remember,
  selectIntention,
} from "../domain/scoring";
import {
  ACTIVITY_INTENTION_IDS,
  GHOST_ACTIVITIES,
  abandonActivity,
  advanceActivity,
  currentActivityStep,
  scoreActivities,
  startNextActivity,
} from "../domain/activities";
import { playbackSurface } from "../domain/episodic-memory";
import {
  finishActivityExperience,
  observeActivityIntention,
} from "../domain/activity-experience";

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
/**
 * An activity contains several decisions, while invitation appeal was tuned
 * for a draw after every decision. Scale the one draw per activity boundary so
 * the same 0.10 appeal stays occasional instead of being amplified fourfold.
 */
const INTERLUDE_APPEAL_SCALE = 0.35;

export type GhostMindPhase =
  | "choosing"
  | "thinking"
  | "perceiving"
  | "acting"
  | "watching"
  | "reacting"
  | "waiting";

export interface GhostMindStatus {
  phase: GhostMindPhase;
  activityId: string | null;
  activityStepIndex: number;
  activityStepCount: number;
  plan: string[];
  intentionId: string | null;
  targetLabel: string | null;
  activityCandidates: Array<{
    id: string;
    score: number;
    baseScore: number;
    expectedValue: number;
    expectedAchievement: number;
    expectedPresentationChange: number;
    expectedDiscovery: number;
    confidence: number;
    reliability: number;
    uncertainty: number;
    predictionSource: "activity" | "goal" | "prior";
  }>;
  navigationOptions: GhostNavigationOption[];
  navigationChoice: GhostNavigationOption | null;
}

export interface GhostMind {
  /** The visible monologue. Null before the first decision. */
  readonly thought: string | null;
  readonly mood: GhostMood;
  /** Live observability for the optional developer HUD. */
  readonly status: GhostMindStatus;
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
  /** HUD observation is opt-in so simulations do not pay for visual snapshots. */
  observe?: () => boolean;
}): GhostMind {
  const now = opts.now ?? (() => performance.now());
  const pace = opts.pace ?? 1;
  const minThoughtMs = MIN_THOUGHT_MS * pace;
  const betweenMs = BETWEEN_MS * pace;
  const rng = opts.rng ?? createRng(opts.seed);
  const trail = createTrail(now);
  const memory = createMemory(rng, trail);
  const intentionsById = new Map(
    opts.intentions.map((intention) => [intention.id, intention])
  );
  const interrupts = opts.intentions.filter((intention) => intention.interrupt);
  const fallbackIntentions = opts.intentions.filter(
    (intention) =>
      !intention.interrupt && !ACTIVITY_INTENTION_IDS.has(intention.id)
  );

  const state = $state<{ thought: string | null; mood: GhostMood }>({
    thought: null,
    mood: "curious",
  });
  // Replaced as one immutable snapshot. Deep-proxying plan and option arrays
  // made a long simulation spend more time instrumenting the mind than running
  // it, while the HUD only ever needs the latest frame.
  let status = $state.raw<GhostMindStatus>({
    phase: "waiting",
    activityId: null,
    activityStepIndex: 0,
    activityStepCount: 0,
    plan: [],
    intentionId: null,
    targetLabel: null,
    activityCandidates: [],
    navigationOptions: [],
    navigationChoice: null,
  });

  let thoughtSetAt = 0;
  let currentModuleId: string | null = null;
  /** Actions that changed or investigated the room, excluding quiet looking. */
  let meaningfulActionsHere = 0;
  let moduleEnteredAt = now();

  /** The world as of the last `readContext`, for the before/after delta. */
  let lastWorld: GhostWorld = opts.sense();

  function readContext(): GhostContext {
    const world = opts.sense();
    lastWorld = world;
    if (world.moduleId !== currentModuleId) {
      /*
       * Leaving. If the ghost did nothing here but navigate, this room has
       * nothing for it — remember that so the navigator stops coming back.
       *
       * The verdict has to be taken on DEPARTURE, not while standing in the
       * room. An earlier version marked a module barren when no intention at
       * all was satisfiable, which never fired: the nav is always on screen, so
       * leaving is always satisfiable and the room never looked empty. The
       * measurement that caught it: practice entered four times in one session
       * and departed immediately every time.
       */
      if (currentModuleId) {
        const episode = memory.moduleEpisodes.get(currentModuleId);
        if (meaningfulActionsHere === 0) {
          memory.barrenModules.add(currentModuleId);
        } else {
          memory.barrenModules.delete(currentModuleId);
          if (episode) episode.productiveVisits += 1;
        }
      }
      meaningfulActionsHere = 0;
      currentModuleId = world.moduleId;
      moduleEnteredAt = now();
      if (world.moduleId) {
        memory.visitedModules.add(world.moduleId);
        const previous = memory.moduleEpisodes.get(world.moduleId);
        memory.moduleEpisodes.set(world.moduleId, {
          visits: (previous?.visits ?? 0) + 1,
          productiveVisits: previous?.productiveVisits ?? 0,
          lastVisitedAt: moduleEnteredAt,
        });
      }
    }
    memory.moduleDwellMs = now() - moduleEnteredAt;
    return { ...world, ...memory };
  }

  function rememberActivityOutcome(
    activity: ActiveGhostActivity | null,
    outcome: "completed" | "abandoned"
  ): void {
    if (!activity) return;
    finishActivityExperience(
      memory.experience,
      activity,
      outcome,
      readContext(),
      now()
    );
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

  function debugLabel(target: HTMLElement | null): string | null {
    if (!target) return null;
    return (
      target.getAttribute("data-ghost-label") ??
      target.getAttribute("aria-label") ??
      target.getAttribute("data-tour-module") ??
      null
    );
  }

  function publishStatus(
    phase: GhostMindPhase,
    ctx: GhostContext,
    intention: Intention | null = null,
    target: HTMLElement | null = null,
    activityCandidates = status.activityCandidates
  ): void {
    if (!opts.observe?.()) return;
    const activity = ctx.activities.current;
    status = {
      phase,
      activityId: activity?.id ?? null,
      activityStepIndex: activity?.stepIndex ?? 0,
      activityStepCount: activity?.steps.length ?? 0,
      plan: activity?.steps.map((item) => item.intentionId) ?? [],
      intentionId: intention?.id ?? null,
      targetLabel: debugLabel(target),
      activityCandidates,
      navigationOptions: [...ctx.navigation.options],
      navigationChoice: ctx.navigation.choice
        ? { ...ctx.navigation.choice }
        : null,
    };
  }

  async function tick(): Promise<void> {
    const g = opts.ghost;
    if (g.halted()) return;

    decayFatigue(memory);
    const ctx = readContext();
    const activityCandidates = opts.observe?.()
      ? scoreActivities(GHOST_ACTIVITIES, ctx, now())
          .slice(0, 4)
          .map(({ definition, score, baseScore, prediction }) => ({
            id: definition.id,
            score,
            baseScore,
            expectedValue: prediction.value,
            expectedAchievement: prediction.achievement,
            expectedPresentationChange: prediction.presentationChange,
            expectedDiscovery: prediction.discovery,
            confidence: prediction.confidence,
            reliability: prediction.reliability,
            uncertainty: prediction.uncertainty,
            predictionSource: prediction.source,
          }))
      : status.activityCandidates;
    publishStatus("choosing", ctx, null, null, activityCandidates);
    let fromActivity = false;
    let intention: Intention | null = null;

    // Blockers and genuine traps are allowed to break a train of thought. They
    // are safety conditions, not competing whims, so fatigue cannot suppress
    // them the way it can suppress an ordinary reset action.
    for (const candidate of interrupts) {
      try {
        if (candidate.can(ctx)) {
          rememberActivityOutcome(
            abandonActivity(memory.activities, now()),
            "abandoned"
          );
          intention = candidate;
          break;
        }
      } catch {
        // A sensor race makes this interrupt unavailable for this tick.
      }
    }

    // Otherwise keep doing the activity already in mind. Optional steps may be
    // skipped when their control is absent; a missing required step invalidates
    // the activity and lets the utility selector choose a different one.
    for (let attempts = 0; !intention && attempts < 24; attempts++) {
      if (!memory.activities.current) {
        // Invitations are interludes. They may happen between activities, but
        // never tear one apart midway through. Their low appeal remains a real
        // probability instead of becoming an automatic win merely because the
        // competing activity lives in a different selector.
        const interlude = selectIntention(fallbackIntentions, ctx);
        if (interlude) {
          let appeal = 0;
          try {
            appeal = Math.max(0, Math.min(1, interlude.appeal(ctx)));
          } catch {
            appeal = 0;
          }
          if (ctx.rng.next() < appeal * INTERLUDE_APPEAL_SCALE) {
            intention = interlude;
            break;
          }
        }
        startNextActivity(GHOST_ACTIVITIES, ctx, now());
      }
      const plannedStep = currentActivityStep(memory.activities);
      if (!plannedStep) break;
      const plannedIntention = intentionsById.get(plannedStep.intentionId);
      let possible = false;
      try {
        possible = plannedIntention?.can(ctx) ?? false;
      } catch {
        possible = false;
      }
      if (plannedIntention && possible) {
        intention = plannedIntention;
        fromActivity = true;
        break;
      }
      if (plannedStep.optional) {
        rememberActivityOutcome(
          advanceActivity(memory.activities, now()),
          "completed"
        );
      } else {
        rememberActivityOutcome(
          abandonActivity(memory.activities, now()),
          "abandoned"
        );
      }
    }

    // A tiny fallback bag remains for host-specific safety or curiosity that
    // no coherent multi-step activity owns. It is not allowed to dismantle an
    // activity by winning a fresh global lottery after every click.
    intention ??= selectIntention(fallbackIntentions, ctx);

    if (!intention) {
      // Nothing satisfiable here — usually a view still loading. Wait rather
      // than spin, and let the next tick re-sense.
      //
      publishStatus("waiting", ctx);
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
        if (fromActivity) {
          observeActivityIntention(memory.experience, intention, false, false);
          rememberActivityOutcome(
            abandonActivity(memory.activities, now()),
            "abandoned"
          );
        }
        await g.sleep(400);
        return;
      }
    }

    const thought = resolveThought(intention, ctx, target);
    publishStatus("thinking", ctx, intention, target, activityCandidates);
    await think(thought, intention.mood ?? "curious");
    if (g.halted()) return;

    // The world as it was BEFORE the action, for `learn` to compare against.
    const before = lastWorld;

    let ok = true;
    try {
      publishStatus(
        intention.operation === "perceive" ? "perceiving" : "acting",
        ctx,
        intention,
        target,
        activityCandidates
      );
      ok = (await intention.perform(g, ctx, target)) !== false;
    } catch (error) {
      // A perform that throws is a lying precondition with extra steps. The
      // trail records it; the tour carries on.
      const debugErrors = (
        globalThis as typeof globalThis & {
          process?: { env?: Record<string, string | undefined> };
        }
      ).process?.env?.GHOST_DEBUG_ERRORS;
      if (debugErrors) console.warn(`[ghost] ${intention.id} failed`, error);
      ok = false;
    }

    if (ok) {
      if (intention.changesPresentation) {
        memory.playback.presentationRevision += 1;
      }
      if (intention.id === "play-it") {
        const after = opts.sense();
        memory.playback.lastPlayedRevision =
          memory.playback.presentationRevision;
        memory.playback.lastPlayedSurface = playbackSurface(after);
        memory.playback.lastPlayedAt = now();
      }
    }

    // LEARN. What actually happened, measured, before anything is said about
    // it. Runs ahead of savor and reaction so that both can be about what the
    // ghost now understands — a realization has to land as a realization, not
    // as an announcement scheduled in advance
    // (spec: 2026-08-06-ghost-understanding-design.md).
    if (ok && intention.concept && intention.learn && !g.halted()) {
      const after = opts.sense();
      let stage: UnderstandingStage | null = null;
      try {
        stage = intention.learn(before, after, ctx);
      } catch {
        // A learn that throws is a belief with no evidence. Believe nothing.
        stage = null;
      }
      if (stage) memory.concepts.set(intention.concept, stage);
    }

    // SAVOR. A beat that produced something to look at gets watched instead of
    // narrated over: the caption goes dark and the ghost steps aside, so for a
    // few seconds the screen is just the running sequence or the lit effect.
    // A show needs valleys or the peaks do not register.
    let watchedPayoff = false;
    if (ok && intention.savor && !g.halted()) {
      const ms =
        typeof intention.savor === "function"
          ? intention.savor(ctx)
          : intention.savor;
      if (ms > 0) {
        watchedPayoff = true;
        // Something worth looking at just happened. clear-and-restart reads
        // this so the ghost cannot bin a thing it has only just finished.
        publishStatus("watching", ctx, intention, target, activityCandidates);
        memory.budgets.lastPayoffAt = trail.lastAt();
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
      if (line) {
        publishStatus("reacting", ctx, intention, target, activityCandidates);
        await think(line, intention.mood ?? "curious");
      }
    }

    if (
      ok &&
      intention.operation !== "perceive" &&
      intention.id !== "go-to-module" &&
      intention.id !== "escape-room"
    ) {
      meaningfulActionsHere++;
      if (currentModuleId) memory.barrenModules.delete(currentModuleId);
    }
    if (fromActivity) {
      observeActivityIntention(memory.experience, intention, ok, watchedPayoff);
      if (ok) {
        rememberActivityOutcome(
          advanceActivity(memory.activities, now()),
          "completed"
        );
      } else {
        rememberActivityOutcome(
          abandonActivity(memory.activities, now()),
          "abandoned"
        );
      }
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

    publishStatus(
      "waiting",
      readContext(),
      intention,
      target,
      activityCandidates
    );

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
    get status() {
      return status;
    },
    seed: rng.seed,
    memory,
    trail,
    tick,
  };
}
