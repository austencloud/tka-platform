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
    // `effect-param`, not `curio`: the dial is a real thing (the chip rows in
    // the effect customize panels) and pressing one visibly changes the effect
    // on the stage. Pointing this at the generic curio bag meant it pressed a
    // nav pill and then narrated it as turning a dial.
    can: (ctx) => has(ctx, "effect-param") && ctx.activeEffectIds.length > 0,
    appeal: () => 0.35,
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "effect-param"))) return false;
      await watchKind(g, "stage", g.jitter(1600, 1000));
      return true;
    },
  },
];

export const PROP_INTENTIONS: Intention[] = [
  {
    id: "open-props",
    category: "props",
    thought: "Can I swap the props?",
    // The prop tiles live in a drawer, and until this existed nothing in the
    // bag could open it — so `try-prop` was unreachable in a normal session
    // even though its tiles were annotated.
    can: (ctx) => has(ctx, "prop-picker") && !has(ctx, "prop") && ctx.hasSequence,
    appeal: () => 0.5,
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "prop-picker"))) return false;
      await g.sleep(g.jitter(900, 600));
      return true;
    },
  },

  {
    id: "try-prop",
    category: "props",
    target: (ctx) => ctx.rng.pick(visibleAll(safe("prop"))) ?? null,
    // Names the prop it actually switches to. It used to name the first
    // non-active tile in the DOM and then let browseKind press a random one.
    thought: (_ctx, target) => {
      const name = target ? labelOf(target).toLowerCase() : "";
      return name ? `What if these were ${name}?` : "What if these were something else?";
    },
    can: (ctx) => has(ctx, "prop") && ctx.hasSequence,
    appeal: () => 0.55,
    perform: async (g, _ctx, target) => {
      if (!target || g.halted()) return false;
      // Still browses a couple of alternatives first — it just commits to the
      // one it named.
      await g.browseThenPress(target);
      // The whole board re-skins live — that is the thing worth watching.
      await g.dwell(g.jitter(2000, 1400));
      return true;
    },
  },
];
