/**
 * playback — the payoff. Making a thing is only half the demonstration; the
 * other half is the ghost settling in to watch what it made.
 */

import { safe } from "../domain/annotations";
import type { Intention } from "../domain/intention";
import { visibleAll } from "../services/sensors";
import { has, labelOf, pressKind, watchKind } from "./helpers";

export const PLAYBACK_INTENTIONS: Intention[] = [
  {
    id: "play-it",
    category: "playback",
    thought: (ctx) =>
      ctx.sequenceWord
        ? `Let's see what ${ctx.sequenceWord} looks like.`
        : "Let's see what that looks like.",
    can: (ctx) => ctx.hasSequence && !ctx.isPlaying && has(ctx, "play"),
    appeal: (ctx) => Math.min(0.95, 0.35 + ctx.sequenceLength * 0.12),
    mood: "delighted",
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "play", 4000))) return false;
      await watchKind(g, "stage", g.jitter(2600, 1800), 4000);
      return true;
    },
  },

  {
    id: "pause-to-look",
    category: "playback",
    thought: "Hold on, what is it doing there?",
    can: (ctx) => ctx.isPlaying && has(ctx, "play"),
    appeal: () => 0.5,
    mood: "unsure",
    perform: async (g, ctx) => {
      // The stage's own tap-to-toggle is POINTER-driven, and the motor layer
      // never dispatches synthetic pointer events (that is what keeps the
      // takeover listener honest) — so the freeze goes through the real
      // play/pause control, which a click does reach.
      if (!(await pressKind(g, ctx, "play", 2000))) return false;
      await g.dwell(g.jitter(1400, 900));
      if (g.halted()) return true;
      await pressKind(g, ctx, "play", 2000);
      await watchKind(g, "stage", g.jitter(1400, 1000));
      return true;
    },
  },

  {
    id: "scrub-back",
    category: "playback",
    thought: "Wait, do that bit again.",
    can: (ctx) => ctx.sequenceLength >= 2 && has(ctx, "step-cell"),
    appeal: (ctx) => (ctx.isPlaying ? 0.55 : 0.25),
    perform: async (g, ctx) => {
      const cells = await g.waitFor(safe("step-cell"), 1500);
      if (cells.length < 2 || g.halted()) return false;
      // An earlier step, never the last — seeking to where it already is
      // reads as a misclick rather than a decision.
      await g.moveAndPress(ctx.rng.pick(cells.slice(0, -1))!);
      if (g.halted()) return true;
      await watchKind(g, "stage", g.jitter(1600, 1200));
      return true;
    },
  },

  {
    id: "change-tempo",
    category: "playback",
    target: (ctx) => ctx.rng.pick(visibleAll(safe("tempo"))) ?? null,
    // The thought is written FROM the preset it is about to press. It used to be
    // the constant "Slower. I want to see the hands." while pressing a random
    // one of Slow/Med/Fast — so it announced slowing down and sped up.
    thought: (_ctx, target) => {
      const label = target ? labelOf(target).toLowerCase() : "";
      if (label.startsWith("slow")) return "Slower. I want to see the hands.";
      if (label.startsWith("fast")) return "Faster — what does that feel like?";
      if (label) return `What about ${labelOf(target!)}?`;
      return "Let's change the tempo.";
    },
    can: (ctx) => has(ctx, "tempo"),
    appeal: (ctx) => (ctx.isPlaying ? 0.4 : 0.15),
    perform: async (g, _ctx, target) => {
      if (!target || g.halted()) return false;
      await g.moveAndPress(target);
      // Watch from where the hand already is — the stage is right there.
      await g.dwell(g.jitter(2000, 1200));
      return true;
    },
  },
];
