/**
 * generate — let the app make one.
 *
 * The generate tab is the single most convincing thing TKA does in front of a
 * stranger: one press and a whole sequence exists. It was also, until now,
 * completely invisible to the presenter — nothing in it carried a `data-ghost`
 * annotation, so the ghost would walk in, find not one satisfiable intention,
 * and bounce back out to construct. Austen (2026-08-05): "I'm not even seeing
 * him mess with generate... he should favor generate and construct and browse."
 *
 * The shape here is deliberately different from `build`. Construct is a slow
 * accumulation the ghost narrates step by step; generate is a wish and a
 * result. So this family is short: change your mind about the settings, ask for
 * one, then look at what you got.
 */

import type { Intention } from "../domain/intention";
import { has, oneOf, pickOf, restlessness } from "./helpers";

/** The generate tab is reachable but its controls are not construct's. */
const inGenerate = (ctx: { available: Record<string, number> }) =>
  (ctx.available.generate ?? 0) > 0;

export const GENERATE_INTENTIONS: Intention[] = [
  {
    id: "generate-one",
    category: "build",
    concept: "generation",
    // The idea is "you can ASK for one instead of making it", and the evidence
    // is a sequence appearing where the ghost built nothing. A press that
    // merely swapped one sequence for another of the same size proves nothing.
    learn: (before, after) =>
      after.sequenceLength > before.sequenceLength + 2 ? "understood" : null,
    thought: (ctx) =>
      ctx.hasSequence
        ? oneOf(ctx, [
            "Let's have it make a different one.",
            "Again, but surprise me.",
            "One more. I want to see what else it does.",
          ])
        : oneOf(ctx, [
            "Let's just have it make one.",
            "I'll let the app decide this time.",
            "What does it come up with on its own?",
          ]),
    can: (ctx) => has(ctx, "generate"),
    // The strongest thing on this screen, by a distance. A person who opens the
    // generate tab is there to press the generate button.
    appeal: () => 0.9,
    mood: "delighted",
    // A whole sequence appearing at once is the biggest payoff in the app, and
    // it deserves the same silence a playthrough gets.
    savor: 3200,
    reaction: (ctx) =>
      ctx.sequenceWord ? `${ctx.sequenceWord}. I'd not have picked that.` : null,
    perform: async (g, ctx) => {
      const el = pickOf(ctx, "generate");
      if (!el || g.halted()) return false;
      await g.moveAndPress(el);
      // Generation is not instant, and walking away mid-spinner reads as a
      // misclick. Wait with it.
      await g.dwell(g.jitter(2200, 1200));
      return true;
    },
  },

  {
    id: "change-the-recipe",
    category: "build",
    target: (ctx) => pickOf(ctx, "generate-option"),
    // Names the dial it is about to turn. "Longer this time" over a press on
    // the level stepper is the narrate-one-thing-do-another bug the target seam
    // exists to prevent.
    thought: (_ctx, target) => {
      const label = target?.getAttribute("data-ghost-label") ?? "";
      if (/length/i.test(label))
        return /increase/i.test(label) ? "Longer this time." : "Shorter. Tighter.";
      if (/level/i.test(label))
        return /increase/i.test(label)
          ? "Harder. Let's see it struggle."
          : "Simpler, so I can follow it.";
      if (label) return `What if I changed ${label}?`;
      return "Let's change the recipe.";
    },
    can: (ctx) => inGenerate(ctx) && has(ctx, "generate-option"),
    // Below `generate-one` on purpose: fiddling with settings and never
    // pressing the button is the generate-tab version of the turns complaint.
    // Rises as the ghost gets bored of the results it is getting.
    appeal: (ctx) => 0.35 + restlessness(ctx) * 0.25,
    perform: async (g, _ctx, target) => {
      if (!target || g.halted()) return false;
      await g.moveAndPress(target);
      await g.sleep(g.jitter(700, 500));
      return true;
    },
  },
];
