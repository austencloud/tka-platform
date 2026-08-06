/**
 * sequence-actions — the half of the app the presenter could not see.
 *
 * Until 2026-08-06 the entire `create/shared/components/sequence-actions/`
 * surface (40 components: Extend, Mirror, Flip, Swap, Invert, Rotate, the step
 * editor) carried not one `data-ghost` attribute, and neither did Undo. The
 * ghost had never touched any of it in any run, because as far as its sensors
 * were concerned none of it existed. Austen (2026-08-06): "I don't even know if
 * they have awareness of the sequence actions."
 *
 * Each intention here is an encounter with an IDEA rather than a control
 * (spec: 2026-08-06-ghost-understanding-design.md), and each one's `learn`
 * reads a measured before/after delta. If the app does not do the surprising
 * thing, the ghost does not claim the insight.
 */

import type { Intention } from "../domain/intention";
import { byStage, has, oneOf, pickOf, pressKind, stageOf } from "./helpers";

export const SEQUENCE_ACTION_INTENTIONS: Intention[] = [
  {
    id: "open-sequence-actions",
    category: "build",
    thought: (ctx) =>
      oneOf(ctx, [
        "What else can I do to the whole thing?",
        "There's a menu here somewhere.",
        "What are my options with this?",
      ]),
    // The door. Nothing behind it is reachable until this is pressed, which is
    // why it needs to exist as its own beat rather than being folded into the
    // actions themselves.
    can: (ctx) =>
      ctx.sequenceLength >= 3 && has(ctx, "sequence-actions") && !has(ctx, "extend"),
    appeal: () => 0.5,
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "sequence-actions", 2000))) return false;
      await g.sleep(g.jitter(1100, 700));
      return true;
    },
  },

  {
    id: "extend-it",
    category: "build",
    concept: "extension",
    thought: (ctx) =>
      byStage(
        ctx,
        "extension",
        {
          unaware: [
            "What's this one? Extend.",
            "Extend. That sounds like it does something.",
          ],
          understood: [
            "This one closes. Let it finish.",
            "Extend — take it back round to the start.",
            "It wants to be a loop. Let it.",
          ],
        },
        "Extend. Let's see.",
      ),
    /*
     * The precondition is the app's own answer, not a guess. TransformsGridMode
     * renders the Extend button inside `{#if onExtend && canExtend}` — so the
     * control exists ONLY on a sequence that genuinely closes. The ghost cannot
     * reach for an extension that is not available, which is the whole point of
     * annotating the real control rather than inferring from step count.
     */
    // Extend DOUBLES the sequence. Run against a 14-step sequence that yields
    // 28 steps, which is not a demonstration, it is a wall — the simulation
    // reached 28 and then binned it. Only offer it while the result stays
    // watchable.
    can: (ctx) => has(ctx, "extend") && ctx.sequenceLength <= 10,
    // The biggest single press in the app: one button turns a fragment into a
    // finished loop. It beats almost everything when it is available at all.
    appeal: () => 0.85,
    mood: "delighted",
    // A sequence completing itself is the best thing on the screen. Watch it.
    savor: 4200,
    learn: (before, after) =>
      after.sequenceLength > before.sequenceLength ? "understood" : null,
    reaction: (ctx) =>
      stageOf(ctx, "extension") === "understood"
        ? oneOf(ctx, [
            "It finished it for me.",
            "Oh, that's the whole loop now.",
            "Back where it started. That's the point of it.",
          ])
        : null,
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "extend", 2500))) return false;
      // Extension computes and applies; walking off mid-spinner reads as a
      // misclick rather than a decision.
      await g.dwell(g.jitter(2400, 1200));
      return true;
    },
  },

  {
    id: "transform-it",
    category: "build",
    concept: "transformation",
    target: (ctx) => pickOf(ctx, "transform"),
    // Names the transform it is about to press — the thought and the action
    // must be about the same control (the target seam exists for exactly this).
    thought: (ctx, target) => {
      const label = target?.getAttribute("data-ghost-label") ?? "";
      const learned = stageOf(ctx, "transformation") === "understood";
      if (!label) return "What if I changed the whole thing at once?";
      if (learned) return `${label}. Same sequence, other way round.`;
      return oneOf(ctx, [
        `What does ${label} do to it?`,
        `${label}. Let's find out.`,
      ]);
    },
    can: (ctx) => has(ctx, "transform") && ctx.sequenceLength >= 3,
    appeal: () => 0.55,
    savor: 2600,
    /*
     * The evidence for "you can change the whole thing without rebuilding it":
     * the WORD changed while the LENGTH did not. A transform that altered the
     * length would be a different idea (that is extension), and one that
     * altered neither did nothing worth understanding.
     */
    learn: (before, after) =>
      after.sequenceLength === before.sequenceLength &&
      after.sequenceWord !== before.sequenceWord
        ? "understood"
        : null,
    reaction: (ctx) =>
      stageOf(ctx, "transformation") === "understood"
        ? oneOf(ctx, [
            "Same sequence. Completely different thing.",
            "It didn't rebuild it — it just turned it over.",
          ])
        : null,
    perform: async (g, _ctx, target) => {
      if (!target || g.halted()) return false;
      await g.moveAndPress(target);
      await g.dwell(g.jitter(1600, 1000));
      return true;
    },
  },

  {
    id: "undo-that",
    category: "build",
    concept: "reversibility",
    thought: (ctx) =>
      byStage(
        ctx,
        "reversibility",
        {
          unaware: [
            "No — not that one.",
            "Hm. That's not what I wanted.",
            "That broke it. Back.",
          ],
          understood: ["Nope. Take that back.", "Not that one — undo."],
        },
        "No, not that.",
      ),
    /*
     * A regret, so it only makes sense immediately after having added something,
     * and only while there is something to take back (`UndoButton` carries the
     * annotation only while `canAct`). Deliberately uncommon: a presenter that
     * undoes a third of what it does looks indecisive rather than human.
     */
    can: (ctx) =>
      has(ctx, "undo") &&
      ctx.sequenceLength >= 2 &&
      ctx.lastCategory === "build" &&
      (ctx.performed.get("undo-that") ?? 0) < 4,
    appeal: () => 0.22,
    mood: "unsure",
    learn: (before, after) =>
      after.sequenceLength < before.sequenceLength ? "understood" : null,
    reaction: (ctx) =>
      stageOf(ctx, "reversibility") === "understood" &&
      (ctx.performed.get("undo-that") ?? 0) <= 1
        ? oneOf(ctx, [
            "Good — nothing here is permanent.",
            "It just takes it back. Fine.",
          ])
        : null,
    perform: async (g, ctx) => {
      // A beat of doubt BEFORE the undo. The pause is the regret; without it
      // this reads as a scripted two-press combo rather than a change of mind.
      await g.sleep(g.jitter(900, 600));
      if (g.halted()) return false;
      if (!(await pressKind(g, ctx, "undo", 1500))) return false;
      await g.dwell(g.jitter(1200, 800));
      return true;
    },
  },
];
