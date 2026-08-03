/**
 * The shop hero's scan timeline.
 *
 * One clock drives both halves of the hero's two-card composition: the scan cue
 * playing over the printed FRONT, and the live mandala draw on the BACK. They
 * are the same event told twice — a phone reads the code, and the card's figure
 * comes alive — so they cannot run on separate timers without drifting apart.
 *
 * TRIGGERED, NOT LOOPED. This used to run itself on an eight-second cycle, and
 * a demo that keeps scanning a card nobody asked it to scan reads as a banner
 * ad. Austen (2026-08-02): "Maybe there should be a little button that says
 * scan the code that activates the flow ... because right now it's just
 * scanning on repeat."
 *
 * So the cue has exactly one entry point, `scan()`, and it runs the pass once:
 *
 *   rest ──scan()──▶ rise 900 ──▶ sweep 1300 ──▶ draw 3600 ──▶ played
 *                                                                 │
 *                                     └──────── scan() ───────────┘
 *
 * The old 2200ms idle beat is gone: the press IS the beat.
 *
 * `played` is a resting state, not an off state. `drawActive` latches at the
 * first sweep and never clears, so once the card has been scanned its sequence
 * keeps playing — that is the product's claim, and tearing the engine down and
 * rebuilding it (a full loop/orchestrator/canvas boot) on every pass would be
 * expensive as well as wrong. What does NOT repeat is the CUE: the phone and
 * the sweep only ever appear because someone pressed the button. A second press
 * replays them, and `cycle` increments so the back card flares again on the new
 * pass, keeping the cause-and-effect reading.
 *
 * Reduced motion parks the whole thing: the phase stays `rest`, `drawActive`
 * stays false, and `available` is false so the host can drop the button — it
 * exists only to start motion, and offering a control that must do nothing is
 * worse than not offering it.
 */

export type ScanCueVariant = "phone" | "pulse";

/**
 * `rest` is before any scan, `rise` brings the cue in, `sweep` reads the code,
 * `draw` is the back card's turn, and `played` is the card left playing.
 */
export type ScanPhase = "rest" | "rise" | "sweep" | "draw" | "played";

/** The phases that advance on their own, and how long each holds. */
type RunningPhase = "rise" | "sweep" | "draw";

const PHASE_MS: Record<RunningPhase, number> = {
  rise: 900,
  sweep: 1300,
  draw: 3600,
};

const NEXT_PHASE: Record<RunningPhase, ScanPhase> = {
  rise: "sweep",
  sweep: "draw",
  draw: "played",
};

export interface HeroScanTimeline {
  readonly phase: ScanPhase;
  /** True once the first sweep has armed the back card's player. Never returns
   *  to false — see the module comment. */
  readonly drawActive: boolean;
  /** Increments on every sweep, so the back card can flare per pass. */
  readonly cycle: number;
  readonly reducedMotion: boolean;
  /** A pass is playing; the trigger stays inert until it finishes. */
  readonly running: boolean;
  /** Has this card been scanned yet? Drives the trigger's label. */
  readonly scanned: boolean;
  /** False under reduced motion, where there is no motion to trigger. */
  readonly available: boolean;
  /** Run one pass. Ignored while a pass is already running. */
  scan(): void;
  start(): void;
  stop(): void;
}

export function createHeroScanTimeline(): HeroScanTimeline {
  let phase = $state<ScanPhase>("rest");
  let drawActive = $state(false);
  let cycle = $state(0);
  let reducedMotion = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let mq: MediaQueryList | null = null;
  let onMediaChange: ((e: MediaQueryListEvent) => void) | null = null;

  const isRunning = (p: ScanPhase): p is RunningPhase =>
    p === "rise" || p === "sweep" || p === "draw";

  function clear(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** Hold the current phase for its duration, then advance to the next. */
  function schedule(): void {
    clear();
    if (!isRunning(phase)) return;
    const current = phase;
    timer = setTimeout(() => {
      timer = null;
      const next = NEXT_PHASE[current];
      phase = next;
      if (next === "sweep") {
        cycle += 1;
        drawActive = true;
      }
      schedule();
    }, PHASE_MS[current]);
  }

  return {
    get phase() {
      return phase;
    },
    get drawActive() {
      return drawActive;
    },
    get cycle() {
      return cycle;
    },
    get reducedMotion() {
      return reducedMotion;
    },
    get running() {
      return isRunning(phase);
    },
    get scanned() {
      return drawActive;
    },
    get available() {
      return !reducedMotion;
    },
    scan(): void {
      if (reducedMotion || isRunning(phase)) return;
      phase = "rise";
      schedule();
    },
    start(): void {
      if (typeof window === "undefined") return;
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      onMediaChange = (e) => {
        reducedMotion = e.matches;
        // Turning reduced motion ON mid-pass parks it immediately. Turning it
        // OFF starts nothing — nothing here ever starts by itself.
        if (e.matches) {
          clear();
          phase = "rest";
        }
      };
      mq.addEventListener("change", onMediaChange);
      reducedMotion = mq.matches;
    },
    stop(): void {
      clear();
      if (mq && onMediaChange) mq.removeEventListener("change", onMediaChange);
      mq = null;
      onMediaChange = null;
    },
  };
}
