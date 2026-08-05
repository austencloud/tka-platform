/**
 * playback — the payoff. Making a thing is only half the demonstration; the
 * other half is the ghost settling in to watch what it made.
 */

import { safe } from "../domain/annotations";
import type { Intention } from "../domain/intention";
import { visibleAll } from "../services/sensors";
import { has, labelOf, pressKind, restlessness, watchKind,
  oneOf,
} from "./helpers";

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
    thought: (ctx) =>
      oneOf(ctx, [
        "Hold on, what is it doing there?",
        "Wait — freeze it there.",
        "How does it get through that bit?",
      ]),
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
    thought: (ctx) =>
      oneOf(ctx, [
        "Wait, do that bit again.",
        "Back up — I missed that.",
        "Let's see that step once more.",
      ]),
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
    id: "try-practice",
    category: "playback",
    thought: (ctx) =>
      oneOf(ctx, ["Let's try this along with it.", "Can I do this with it?"]),
    /*
     * "Wait — can it see me?" is the good line, and it is only true once the
     * stream is actually live. Austen (2026-08-05): "I like wait can it See Me
     * that's pretty cool. But that should only happen if the camera properly
     * connects." So it is a REACTION gated on `cameraLive` — set by
     * CameraPreview when the stream starts and the video attaches, not when the
     * mirror button was pressed. Over a black rectangle or a failed permission
     * the ghost says nothing.
     */
    reaction: (ctx) =>
      ctx.cameraLive
        ? oneOf(ctx, [
            "Wait — can it see me?",
            "Oh — that's me.",
            "Hello. That's the camera.",
          ])
        : null,
    // cameraGranted is the hard gate. Without it, pressing Practice raises a
    // native permission prompt — not DOM, so the ghost can neither answer nor
    // dismiss it, and the tour dead-stops in front of strangers. On the park
    // laptop, grant the camera once by hand and it stays granted for the origin.
    can: (ctx) => ctx.cameraGranted && ctx.hasSequence && has(ctx, "practice"),
    appeal: () => 0.5,
    mood: "delighted",
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "practice", 2500))) return false;
      await g.sleep(g.jitter(1400, 800));
      if (g.halted()) return true;
      // The mirror is off by default, and the mirror IS the effect — a passerby
      // seeing themselves behind the props.
      await pressKind(g, ctx, "mirror", 2500);
      await g.dwell(g.jitter(9000, 6000));
      return true;
    },
  },

  {
    id: "leave-practice",
    category: "playback",
    // Bounded on purpose. An unattended laptop must not hold the camera open
    // all night — battery, thermals, and a live camera nobody is standing in
    // front of. Restlessness makes leaving read as a decision.
    thought: "Alright, back to it.",
    can: (ctx) => has(ctx, "practice-stop"),
    appeal: (ctx) => 0.25 + restlessness(ctx) * 0.6,
    perform: async (g, ctx) => {
      if (!(await pressKind(g, ctx, "practice-stop", 2000))) return false;
      await g.sleep(g.jitter(1200, 800));
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
