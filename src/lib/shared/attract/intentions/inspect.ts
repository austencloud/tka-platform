/**
 * inspect — looking closely at what is already there.
 *
 * The presenter could make things and dress them up, but it could not do the
 * thing a person does when something catches their eye: stop, step through it
 * one frame at a time, and change one detail of one step.
 *
 * Austen (2026-08-06): "it's more valuable to make sure that it actually uses
 * the whole scope of what is available to users in my program."
 *
 * These three all share a property that makes them safe for an unattended
 * machine: nothing here writes, exports, deletes or leaves the app. Stepping
 * and view toggles are reversible by construction, and a step edit is undoable.
 */

import { safe } from "../domain/annotations";
import type { Intention } from "../domain/intention";
import { visibleAll } from "../services/sensors";
import { has, labelOf, oneOf, pickOf, restlessness } from "./helpers";

export const INSPECT_INTENTIONS: Intention[] = [
  {
    id: "step-through-it",
    category: "playback",
    changesPresentation: true,
    thought: (ctx) =>
      oneOf(ctx, [
        "Hold on — one step at a time.",
        "Let's walk through that slowly.",
        "What actually happens between those two?",
      ]),
    // Scrubbing is what a person does when playback went past something they
    // wanted to see. It only makes sense on a sequence long enough to have a
    // middle, and it is most wanted right after watching.
    target: (ctx) =>
      ctx.rng.pick(
        visibleAll(safe("step-nav")).filter(
          (el) => !(el as HTMLButtonElement).disabled
        )
      ) ?? null,
    can: (ctx) => has(ctx, "step-nav") && ctx.sequenceLength >= 3,
    appeal: (ctx) => (ctx.isPlaying ? 0.2 : 0.45),
    mood: "curious",
    // The repetition IS the beat: one press is a misclick, four in a row is
    // somebody studying a transition. One chosen direction is held for the
    // whole beat, so it never reads as random Next/Previous/Restart thrashing.
    perform: async (g, ctx, target) => {
      if (!target || g.halted()) return false;
      const firstLabel = labelOf(target);
      const steps = 2 + ctx.rng.int(3);
      for (let i = 0; i < steps && !g.halted(); i++) {
        const candidates =
          i === 0
            ? [target]
            : (await g.waitFor(safe("step-nav"), 1500)).filter(
                (el) => !(el as HTMLButtonElement).disabled
              );
        const chosen =
          i === 0
            ? target
            : firstLabel.toLowerCase().startsWith("restart")
              ? candidates.find((el) =>
                  labelOf(el).toLowerCase().startsWith("next")
                )
              : candidates.find((el) => labelOf(el) === firstLabel);
        if (!chosen) return i > 0;
        await g.moveAndPress(chosen);
        // Long enough to actually read the pictograph that just landed.
        await g.dwell(g.jitter(1100, 700));
      }
      return true;
    },
  },

  {
    id: "change-the-view",
    category: "explore",
    changesPresentation: true,
    target: (ctx) => pickOf(ctx, "view-toggle"),
    // Names the toggle it presses. A view toggle changes nothing about the
    // sequence, so the honest framing is "let me look at it differently",
    // never "let me change it".
    thought: (ctx, target) => {
      const label = target?.getAttribute("data-ghost-label") ?? "";
      if (!label) return "Let's look at it another way.";
      return oneOf(ctx, [
        `What does ${label} show me?`,
        `${label}. Let's see.`,
      ]);
    },
    can: (ctx) => has(ctx, "view-toggle") && ctx.hasSequence,
    appeal: () => 0.35,
    perform: async (g, _ctx, target) => {
      if (!target || g.halted()) return false;
      await g.moveAndPress(target);
      await g.dwell(g.jitter(1800, 1100));
      return true;
    },
  },

  {
    id: "edit-one-step",
    category: "build",
    changesPresentation: true,
    target: (ctx) => pickOf(ctx, "step-edit"),
    thought: (ctx, target) => {
      const label = target?.getAttribute("data-ghost-label") ?? "";
      if (!label) return "What if this one step were different?";
      return oneOf(ctx, [
        `What if this one were ${label}?`,
        `Try ${label} on this step.`,
      ]);
    },
    // Editing a single step is the most TKA-specific thing in the app and the
    // hardest to discover, so it is worth showing — but only once a step is
    // actually selected and the editor is open, which is what the annotation
    // being present already tells us.
    can: (ctx) => has(ctx, "step-edit") && ctx.sequenceLength >= 2,
    appeal: (ctx) => 0.4 + restlessness(ctx) * 0.15,
    // One step changing inside a sequence is a small, precise difference —
    // exactly the kind that is invisible if the ghost is still talking over it.
    savor: 2400,
    perform: async (g, _ctx, target) => {
      if (!target || g.halted()) return false;
      await g.moveAndPress(target);
      await g.dwell(g.jitter(1600, 1000));
      return true;
    },
  },
];
