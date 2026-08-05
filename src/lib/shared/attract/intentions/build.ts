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
import { browseKind, has, pressKind, restlessness } from "./helpers";

export const BUILD_INTENTIONS: Intention[] = [
  {
    id: "pick-start",
    category: "build",
    thought: "Let's start somewhere.",
    can: (ctx) => !ctx.hasSequence && has(ctx, "start-position"),
    appeal: () => 0.9,
    perform: (g) => browseKind(g, "start-position"),
  },

  {
    id: "add-step",
    category: "build",
    thought: (ctx) =>
      ctx.sequenceLength > 3 ? "One more after that." : "What comes next?",
    can: (ctx) => ctx.hasSequence && has(ctx, "option"),
    // Strong early, tapering off — a sequence that never stops growing stops
    // being a demonstration and becomes a wall.
    appeal: (ctx) => Math.max(0.15, 0.85 - ctx.sequenceLength * 0.08),
    perform: (g) => browseKind(g, "option"),
  },

  {
    id: "filter-continuous",
    category: "build",
    thought: "I wonder if anything continues from this.",
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
    thought: "What if this hand turned instead?",
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
    id: "page-families",
    category: "build",
    thought: "What else is over here?",
    can: (ctx) => has(ctx, "option-pager"),
    appeal: () => 0.3,
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "option-pager", 800))) return false;
      await g.sleep(g.jitter(500, 400));
      return true;
    },
  },

  {
    id: "clear-and-restart",
    category: "reset",
    thought: "Let's try something completely different.",
    can: (ctx) => ctx.hasSequence && ctx.sequenceLength >= 3 && has(ctx, "clear"),
    // Only once it has actually made something and stayed a while.
    appeal: (ctx) => Math.min(0.7, ctx.sequenceLength * 0.08 + restlessness(ctx) * 0.4),
    mood: "bored",
    perform: (g, ctx) => pressKind(g, ctx, "clear"),
  },
];
