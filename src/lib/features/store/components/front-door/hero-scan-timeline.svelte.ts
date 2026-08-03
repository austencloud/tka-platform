/**
 * The shop hero's scan timeline.
 *
 * One clock drives both halves of the hero's two-card composition: the scan cue
 * playing over the printed FRONT, and the live mandala draw on the BACK. They
 * are the same event told twice — a phone reads the code, and the card's figure
 * comes alive — so they cannot run on separate timers without drifting apart.
 *
 * TRIGGERED, NOT LOOPED. This used to run itself on an eight-second pass, and
 * a demo that keeps scanning a card nobody asked it to scan reads as a banner
 * ad. Austen (2026-08-02): "Maybe there should be a little button that says
 * scan the code that activates the flow ... because right now it's just
 * scanning on repeat."
 *
 * So the cue has exactly one entry point, `scan()`, and it runs the pass once:
 *
 *   rest ──scan()──▶ aim 900 ──▶ lock 900 ──▶ opening 620 ──▶ open
 *                                                               │
 *                                 └──────── scan() ─────────────┘
 *
 * The old 2200ms idle beat is gone: the press IS the beat.
 *
 * `open` is a resting state, not an off state. `armed` latches when the phone
 * first aims and never clears: it is what boots the iframe, and the scan page
 * stays up afterwards because that is what a phone does — you do not scan a
 * card and watch the page leave. What does NOT repeat is the choreography. A
 * second press runs it again, and `pass` increments so a consumer can restart
 * per-pass effects without remounting anything.
 *
 * Reduced motion skips the CHOREOGRAPHY, not the payoff. Pressing still has a
 * real result now — the actual scan page appears — so the button stays, and the
 * host jumps straight to `open` instead of walking the three beats. That is why
 * `available` no longer depends on motion at all.
 */

export type ScanCueVariant = "phone" | "pulse";

/**
 * `rest` is before any scan, `aim` leans the phone in on its camera view,
 * `lock` is the code recognised (the chip pops), `opening` swipes the screen up
 * into the real /q, and `open` is the scan page left standing.
 */
export type ScanPhase = "rest" | "aim" | "lock" | "opening" | "open";

/** The phases that advance on their own, and how long each holds. */
type RunningPhase = "aim" | "lock" | "opening";

const PHASE_MS: Record<RunningPhase, number> = {
  aim: 900,
  lock: 900,
  opening: 620,
};

const NEXT_PHASE: Record<RunningPhase, ScanPhase> = {
  aim: "lock",
  lock: "opening",
  opening: "open",
};

export interface HeroScanTimeline {
  readonly phase: ScanPhase;
  /** True once the phone has aimed at least once: boots the iframe. Never
   *  returns to false — see the module comment. */
  readonly armed: boolean;
  /** Increments on every pass. */
  readonly pass: number;
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
  let armed = $state(false);
  let pass = $state(0);
  let reducedMotion = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let mq: MediaQueryList | null = null;
  let onMediaChange: ((e: MediaQueryListEvent) => void) | null = null;

  const isRunning = (p: ScanPhase): p is RunningPhase =>
    p === "aim" || p === "lock" || p === "opening";

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
      if (next === "lock") {
        pass += 1;
        armed = true;
      }
      schedule();
    }, PHASE_MS[current]);
  }

  return {
    get phase() {
      return phase;
    },
    get armed() {
      return armed;
    },
    get pass() {
      return pass;
    },
    get reducedMotion() {
      return reducedMotion;
    },
    get running() {
      return isRunning(phase);
    },
    get scanned() {
      return armed;
    },
    get available() {
      // Always. The button's payoff is the real scan page, not the motion.
      return true;
    },
    scan(): void {
      if (isRunning(phase)) return;
      if (reducedMotion) {
        // Skip the three beats, keep the result: the page simply appears.
        clear();
        pass += 1;
        armed = true;
        phase = "open";
        return;
      }
      phase = "aim";
      schedule();
    },
    start(): void {
      if (typeof window === "undefined") return;
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      onMediaChange = (e) => {
        reducedMotion = e.matches;
        // Turning reduced motion ON mid-pass lands it immediately rather than
        // abandoning it: the visitor asked for the result without the motion,
        // and they had already asked for the result. Turning it OFF starts
        // nothing — nothing here ever starts by itself.
        if (e.matches && isRunning(phase)) {
          clear();
          armed = true;
          phase = "open";
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
