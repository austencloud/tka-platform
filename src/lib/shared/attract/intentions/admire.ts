/**
 * admire — "spend more time on the things that are really pretty."
 *
 * `linger` is the only intention that deliberately does nothing. A presenter
 * that never stops moving reads as a machine working through a list; the
 * pauses are what make the rest look like choices.
 */

import { LINGER_SEL } from "../domain/annotations";
import type { Intention } from "../domain/intention";
import { visibleAll } from "../services/sensors";
import { has, watchKind } from "./helpers";

export const ADMIRE_INTENTIONS: Intention[] = [
  {
    id: "linger",
    category: "admire",
    thought: "…",
    can: (ctx) => ctx.lingerCount > 0,
    appeal: () => 0.45,
    mood: "still",
    perform: async (g, ctx) => {
      const targets = visibleAll(LINGER_SEL);
      const target = ctx.rng.pick(targets);
      if (!target || g.halted()) return false;
      g.setHover(null);
      await g.restBeside(target);
      await g.dwell(g.jitter(4000, 4000));
      return true;
    },
  },

  {
    id: "open-mandala",
    category: "admire",
    thought: "This is the whole sequence at once.",
    can: (ctx) => has(ctx, "curio") && ctx.hasSequence && ctx.lingerCount === 0,
    appeal: () => 0.3,
    mood: "delighted",
    perform: async (g) => watchKind(g, "stage", g.jitter(3500, 2500)),
  },
];
