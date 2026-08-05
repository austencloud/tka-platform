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
import { has, pickOf, pressKind, restlessness, voiced } from "./helpers";
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
    can: (ctx) => ctx.hasSequence && has(ctx, "option"),
    // Strong early, tapering off — a sequence that never stops growing stops
    // being a demonstration and becomes a wall.
    appeal: (ctx) => Math.max(0.15, 0.85 - ctx.sequenceLength * 0.08),
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
      voiced(ctx, "filter-continuous", [
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
      voiced(ctx, "fiddle-turns", [
        "What if this hand turned instead?",
        "Let's put a turn on it.",
        "What happens if I add rotation here?",
      ]),
    can: (ctx) => has(ctx, "turn"),
    appeal: (ctx) => (ctx.hasSequence ? 0.5 : 0.2),
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
      voiced(ctx, "clear-and-restart", [
        "Let's try something completely different.",
        "Scrap it. Start again.",
        "I want to build something else.",
      ]),
    can: (ctx) => ctx.hasSequence && ctx.sequenceLength >= 3 && has(ctx, "clear"),
    // Only once it has actually made something and stayed a while.
    appeal: (ctx) => Math.min(0.7, ctx.sequenceLength * 0.08 + restlessness(ctx) * 0.4),
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
