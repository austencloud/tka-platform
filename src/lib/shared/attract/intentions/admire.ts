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
];

/*
 * There was an `open-mandala` here. It claimed "This is the whole sequence at
 * once" and then performed watchKind("stage") — it never opened a mandala, and
 * its `can` was gated on `curio`, which at the time nothing in the app carried.
 * Deleted rather than reworded: the mandala surface now carries
 * `data-ghost-linger` (MandalaPane), so `linger` covers it honestly and the
 * ghost sits with it because it is beautiful, which was the real intent.
 */
