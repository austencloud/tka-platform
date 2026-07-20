/**
 * Generate Attract Act — drives the Generate demo while nobody is touching it
 * (spec: docs/superpowers/specs/2026-07-19-construct-attract-demo-design.md,
 * §Generate wing).
 *
 * A thin SCRIPT on the shared attract-ghost core (attract-ghost.svelte.ts owns
 * the motor model, press gate, and pause/park/resume lifecycle). Each cycle it
 * ponders the four REAL parameter cards, nudges a stepper or two (sometimes
 * flips the grid toggle), presses the REAL Generate button, and settles in to
 * watch the result play — occasionally pausing the canvas to look closer. All
 * presses are real clicks on the real controls, so the demo can only ever do
 * what a visitor could do.
 */

import {
  createAttractGhost,
  type AttractActHandle,
} from "./attract-ghost.svelte";

// Stepper touch zones across the Length / Level / Turn-intensity cards. The
// :not(:disabled) filter keeps the ghost off dead ends (length at its cap,
// level at its edge) — pressing a disabled zone reads as a misclick.
const STEP_UP_SEL = ".card-grid .touch-zone.increment-zone:not(:disabled)";
const STEP_DOWN_SEL = ".card-grid .touch-zone.decrement-zone:not(:disabled)";
// The Grid card is one whole-card toggle button (ToggleCard) — a single press
// flips diamond/box and the label animates, a satisfying fiddle beat.
const GRID_SEL = ".card-grid .toggle-card";
// The section's real Generate button; disabled while the engine runs.
const GENERATE_SEL = ".generate-button:not(:disabled)";
// The player stage the result animates in.
const STAGE_SEL = "[data-demo-stage]";

export type GenerateAttractAct = AttractActHandle;

export function createGenerateAttractAct(opts: {
  /** The demo band — coordinate space for the ghost AND the query root. */
  getRoot: () => HTMLElement | null;
  /**
   * Toggles the result player's playback (InlineAnimationPlayer's
   * onTogglePlaybackRef fn). The real tap-to-toggle listens for POINTER
   * events, and the act must never dispatch synthetic pointerdown (that would
   * trip the section's takeover capture listener) — so the ghost performs the
   * press visually and this callback performs the toggle.
   */
  togglePlayback: () => void;
}): GenerateAttractAct {
  const { core: g, run } = createAttractGhost({ getRoot: opts.getRoot });

  /** Nudge one stepper zone, sometimes twice in a row — stepping length from
   *  4 to 8 in two presses reads as a decision, not a twitch. */
  async function nudgeStepper(): Promise<void> {
    const sel = Math.random() < 0.65 ? STEP_UP_SEL : STEP_DOWN_SEL;
    const zones = await g.waitFor(sel, 1200);
    if (!zones.length || g.halted()) return;
    const zone = g.pick(zones);
    await g.moveAndPress(zone);
    await g.sleep(g.jitter(350, 400));
    if (Math.random() < 0.4 && !g.halted() && zone.offsetParent !== null) {
      // Same zone again — a deliberate second step, quick like a real repeat.
      if (!zone.matches(":disabled")) {
        await g.moveAndPress(zone);
        await g.sleep(g.jitter(300, 300));
      }
    }
  }

  /** Flip the diamond/box grid toggle. */
  async function flipGrid(): Promise<void> {
    const toggles = await g.waitFor(GRID_SEL, 1200);
    if (!toggles.length || g.halted()) return;
    await g.moveAndPress(toggles[0]!);
    await g.sleep(g.jitter(450, 400));
  }

  async function cycle(): Promise<void> {
    await g.sleep(600);

    // Ponder the cards: one or two parameter changes per cycle, so every
    // generation visibly comes from a different recipe. Occasionally the grid
    // toggle joins in.
    const fiddles = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < fiddles && !g.halted(); i++) {
      await nudgeStepper();
    }
    if (Math.random() < 0.35 && !g.halted()) {
      await flipGrid();
    }
    if (g.halted()) return;

    // Commit: press Generate for real.
    const gen = await g.waitFor(GENERATE_SEL, 3000);
    if (!gen.length || g.halted()) return;
    await g.moveAndPress(gen[0]!);

    // The engine chunk loads on first press and the beam search takes a
    // moment — rest beside the stage while it thinks, like a person waiting
    // on a dice roll. waitFor tolerates the canvas not existing yet.
    const stage = await g.waitFor(STAGE_SEL, 4000);
    if (!stage.length || g.halted()) return;
    await g.restBeside(stage[0]!);
    await g.dwell(g.jitter(2400, 1600)); // watch the result unfold

    // Sometimes pause the canvas to study a pose, then resume — the same
    // tap-to-toggle demonstration the construct act performs.
    if (Math.random() < 0.4 && !g.halted()) {
      await g.moveAndPress(stage[0]!, opts.togglePlayback); // pause
      await g.dwell(g.jitter(1100, 800)); // hold the freeze
      if (g.halted()) return;
      await g.moveAndPress(stage[0]!, opts.togglePlayback); // resume
      await g.restBeside(stage[0]!);
    }

    // Watch a while longer, then go again with a new recipe.
    await g.dwell(g.jitter(2600, 2000));
  }

  return run(cycle);
}
