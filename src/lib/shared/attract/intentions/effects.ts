/**
 * effects + props — dressing up what it made. This is the group the fatigue
 * model exists for: left unchecked the ghost would tweak effects forever,
 * because every tweak is cheap and every result is pretty.
 */

import { safe } from "../domain/annotations";
import type { Intention } from "../domain/intention";
import { browseKind, has, labelOf, pressKind, watchKind } from "./helpers";

export const EFFECT_INTENTIONS: Intention[] = [
  {
    id: "try-effect",
    category: "effects",
    thought: "I wonder what this looks like with something on it.",
    can: (ctx) => has(ctx, "effect") && ctx.hasSequence,
    appeal: (ctx) => (ctx.activeEffectIds.length ? 0.45 : 0.7),
    perform: async (g) => {
      if (!(await browseKind(g, "effect"))) return false;
      await watchKind(g, "stage", g.jitter(2200, 1500));
      return true;
    },
  },

  {
    id: "reject-effect",
    category: "effects",
    thought: "…no. Not that one.",
    can: (ctx) => has(ctx, "effect") && ctx.activeEffectIds.length > 0,
    appeal: () => 0.4,
    mood: "unsure",
    perform: async (g, ctx) => {
      // Turn the current one off, look at the plain version, pick another.
      const active = await g.waitFor(`${safe("effect")}[data-ghost-active]`, 1500);
      if (!active.length || g.halted()) return false;
      await g.moveAndPress(active[0]!);
      await g.dwell(g.jitter(900, 700));
      if (g.halted()) return true;
      await pressKind(g, ctx, "effect", 1500);
      await watchKind(g, "stage", g.jitter(1800, 1200));
      return true;
    },
  },

  {
    id: "tune-effect",
    category: "effects",
    thought: (ctx) =>
      ctx.activeEffectIds.length
        ? "A little more of that."
        : "What does this dial do?",
    can: (ctx) => has(ctx, "curio") && ctx.activeEffectIds.length > 0,
    appeal: () => 0.35,
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "curio"))) return false;
      await watchKind(g, "stage", g.jitter(1600, 1000));
      return true;
    },
  },
];

export const PROP_INTENTIONS: Intention[] = [
  {
    id: "try-prop",
    category: "props",
    thought: (ctx) => {
      const el = document.querySelector<HTMLElement>(
        `${safe("prop")}:not([data-ghost-active])`,
      );
      const name = el ? labelOf(el).toLowerCase() : "";
      void ctx;
      return name ? `What if these were ${name}?` : "What if these were something else?";
    },
    can: (ctx) => has(ctx, "prop") && ctx.hasSequence,
    appeal: () => 0.55,
    perform: async (g) => {
      if (!(await browseKind(g, "prop"))) return false;
      // The whole board re-skins live — that is the thing worth watching.
      await watchKind(g, "stage", g.jitter(2000, 1400));
      return true;
    },
  },
];
