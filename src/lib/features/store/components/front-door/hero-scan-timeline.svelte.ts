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
 *   rest ─scan()─▶ enter 640 ─▶ aim 900 ─▶ lock 900 ─▶ opening 620 ─▶ open
 *                                 ▲                                  │
 *                                 └────────── scan() ────────────────┘
 *
 * The old 2200ms idle beat is gone: the press IS the beat.
 *
 * `enter` is the phone ARRIVING. Austen (2026-08-03): "instead of just having
 * the phone there from the gate, maybe we have the two cards next to each other
 * and then when you click scan those 2 cards kind of move to the side and stack
 * a little closer and then that phone slides in." So at rest the stage is two
 * cards and nothing else, and the phone is an entrance rather than furniture.
 *
 * A SECOND press on the SAME card skips `enter` and starts at `aim`: the phone
 * is already standing there, and walking it off and back on would replay a beat
 * that only means something once.
 *
 * DEALING IS DIFFERENT, and this is the 2026-08-04 correction. A deal used to
 * swap the stack behind the standing phone and then scan the new card by
 * itself. Austen: "when I deal another card the phone should not be there yet.
 * It should just make the cards and the phone go away with an animation, then
 * it should deal in 2 fresh cards side by side, and then I should have to click
 * scan this card again to scan it with the phone." So a deal calls `reset()` —
 * the stage empties, the iframe unmounts, and the entrance is earned again by
 * the next press. Nothing here scans on its own anymore.
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
 * `rest` is two cards and an empty stage, `enter` parts the cards and slides the
 * phone in front of them, `aim` leans the phone in on its camera view, `lock` is
 * the code recognised (the chip pops), `opening` swipes the screen up into the
 * real /q, and `open` is the scan page left standing.
 */
export type ScanPhase = "rest" | "enter" | "aim" | "lock" | "opening" | "open";

/** The phases that advance on their own, and how long each holds. */
type RunningPhase = "enter" | "aim" | "lock" | "opening";

const PHASE_MS: Record<RunningPhase, number> = {
  enter: 640,
  aim: 900,
  lock: 900,
  opening: 620,
};

const NEXT_PHASE: Record<RunningPhase, ScanPhase> = {
  enter: "aim",
  aim: "lock",
  lock: "opening",
  opening: "open",
};

export interface HeroScanTimeline {
  readonly phase: ScanPhase;
  /** True once the phone has aimed at least once: boots the iframe. Never
   *  returns to false — see the module comment. */
  readonly armed: boolean;
  /** The phone has entered the scene. False only before the first press, which
   *  is the one state where the stage is two cards and nothing else. */
  readonly onstage: boolean;
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
  /**
   * Back to an empty stage: the phone is off, the iframe unmounts, and the
   * entrance has to be earned again. Dealing a card calls this — see below.
   */
  reset(): void;
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
    p === "enter" || p === "aim" || p === "lock" || p === "opening";

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
      // Boot the iframe the moment the phone has LANDED, not when the code is
      // read: that hands /q the whole aim+lock beat (1.8s) to load before the
      // screen swipes up, so the honest loading state is usually already past.
      if (next === "aim") armed = true;
      if (next === "lock") pass += 1;
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
    get onstage() {
      return phase !== "rest";
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
        // Skip every beat, keep the result: the phone is simply there, with the
        // page on it. No entrance, no camera, no swipe.
        clear();
        pass += 1;
        armed = true;
        phase = "open";
        return;
      }
      // The entrance happens once per stage. After it, the phone is standing
      // there and a press picks up at the camera. A deal returns the stage to
      // rest (see `reset`), so the next card earns the entrance again.
      phase = phase === "rest" ? "enter" : "aim";
      schedule();
    },
    reset(): void {
      // Dealing a card clears the stage. `armed` drops with it — that is what
      // unmounts the iframe, so the next press boots the NEW code fresh and
      // keeps its honest loading beat instead of revealing a page that was
      // already sitting there for a card the visitor is no longer holding.
      // `scanned` reads `armed`, so the trigger reverts to "Scan the code" by
      // the same stroke. `pass` deliberately survives: it counts passes for
      // per-pass effects, and a deal is not a pass.
      clear();
      phase = "rest";
      armed = false;
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
