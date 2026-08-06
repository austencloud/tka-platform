/**
 * build — making a sequence, one small decision at a time.
 *
 * These lift almost directly from construct-attract-act.svelte.ts, which is
 * exactly what the spec predicted: its fiddleTurns / fiddleFilter / pageSections
 * beats were already intention-sized. What changes is that nothing here
 * sequences them — the mind does, differently every time.
 */

import { safe } from "../domain/annotations";
import type { Intention } from "../domain/intention";
import { visibleAll } from "../services/sensors";
import { has, oneOf, pickOf, pressKind, restlessness } from "./helpers";
import { monologueFor } from "./monologue";

export const BUILD_INTENTIONS: Intention[] = [
  {
    id: "pick-start",
    category: "build",
    target: (ctx) => pickOf(ctx, "start-position"),
    thought: (ctx, target) =>
      monologueFor("start-position", target, ctx, "Let's start somewhere."),
    can: (ctx) => !ctx.hasSequence && has(ctx, "start-position"),
    appeal: () => 0.9,
    perform: async (g, ctx, target) => {
      if (!target || g.halted()) return false;
      await g.browseThenPress(target, visibleAll(safe("start-position")));
      return true;
    },
  },

  {
    id: "add-step",
    category: "build",
    target: (ctx) => pickOf(ctx, "option"),
    // Names the letter it is about to add. "What comes next?" said nothing about
    // the forty pictographs on screen; "P looks like it fits" is a decision.
    thought: (ctx, target) =>
      monologueFor(
        "option",
        target,
        ctx,
        ctx.sequenceLength > 3 ? "One more after that." : "What comes next?",
      ),
    // The one intention whose job is repetition: a person building a sequence
    // presses option after option, and the novelty penalty made that
    // impossible (see Intention.repeatable). `can` carries the ceiling that
    // novelty used to provide by accident.
    repeatable: true,
    can: (ctx) => ctx.hasSequence && ctx.sequenceLength < 16 && has(ctx, "option"),
    // Strong until it is a real sequence, then tapering — a sequence that never
    // stops growing stops being a demonstration and becomes a wall. The knee is
    // deliberately past 8: eight steps is a word, three is a fragment.
    appeal: (ctx) =>
      ctx.sequenceLength < 8
        ? 0.9
        : Math.max(0.12, 0.9 - (ctx.sequenceLength - 8) * 0.1),
    perform: async (g, ctx, target) => {
      if (!target || g.halted()) return false;
      await g.browseThenPress(target, visibleAll(safe("option")));
      return true;
    },
  },

  {
    id: "filter-continuous",
    category: "build",
    thought: (ctx) =>
      oneOf(ctx, [
        "I wonder if anything continues from this.",
        "Only the ones that flow on, then.",
        "What actually follows this?",
      ]),
    can: (ctx) => has(ctx, "option-filter"),
    appeal: (ctx) => (ctx.hasSequence ? 0.45 : 0.1),
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "option-filter"))) return false;
      await g.sleep(g.jitter(600, 500));
      if (g.halted()) return true;
      // The retreat a person makes from a filter that filtered everything out.
      const left = await g.waitFor(safe("option"), 2500);
      if (!left.length && !g.halted()) {
        await pressKind(g, ctx, "option-filter", 800);
        await g.sleep(g.jitter(400, 300));
      }
      return true;
    },
  },

  {
    id: "fiddle-turns",
    category: "build",
    thought: (ctx) =>
      oneOf(ctx, [
        "What if this hand turned instead?",
        "Let's put a turn on it.",
        "What happens if I add rotation here?",
      ]),
    // A turn decorates a sequence that already exists. Firing it at one or two
    // steps is the "sets a turn value and then never applies an option" tell
    // Austen watched live — it reads as fiddling with settings instead of
    // making something. Decoration waits until there is something to decorate.
    can: (ctx) => ctx.sequenceLength >= 4 && has(ctx, "turn"),
    appeal: () => 0.4,
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "turn"))) return false;
      await g.sleep(g.jitter(500, 500));
      // Sometimes the other hand too — the grid re-derives either way.
      if (ctx.rng.next() < 0.35 && !g.halted()) {
        await pressKind(g, ctx, "turn", 1500);
      }
      return true;
    },
  },

  {
    id: "clear-and-restart",
    category: "reset",
    thought: (ctx) =>
      oneOf(ctx, [
        "Let's try something completely different.",
        "Scrap it. Start again.",
        "I want to build something else.",
      ]),
    // Only once it has actually FINISHED something. At three steps this was
    // outscoring `add-step` and throwing away a fragment — the ghost binned
    // every sequence it started at exactly three, seven times in a 200-decision
    // run, which is why nobody ever saw it make anything.
    can: (ctx) => ctx.sequenceLength >= 6 && has(ctx, "clear"),
    // Boredom, not length, is the motive. A long sequence is a reason to keep
    // playing with it, not a reason to bin it.
    appeal: (ctx) => Math.min(0.6, restlessness(ctx) * 0.55),
    mood: "bored",
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "clear"))) return false;
      // Clearing raises a confirmation unless the operator turned it off, and a
      // modal the ghost walks away from is the worst state in the system: the
      // backdrop makes every other control fail the hit-test, so the whole bag
      // goes quiet and the tour is over until a human dismisses it. Going
      // through with the dialog is part of the intention, not a follow-up.
      const confirms = await g.waitFor(safe("confirm"), 1200);
      if (!confirms.length || g.halted()) return true;
      await g.moveAndPress(confirms[0]!);
      await g.sleep(g.jitter(700, 500));
      return true;
    },
  },
];
