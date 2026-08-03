/**
 * The shop hero's scan timeline.
 *
 * One clock drives both halves of the hero's two-card composition: the scan cue
 * playing over the printed FRONT, and the live mandala draw on the BACK. They
 * are the same event told twice — a phone reads the code, and the card's figure
 * comes alive — so they cannot run on separate timers without drifting apart.
 *
 * The cycle: a quiet beat, the cue rises over the front card, one sweep across
 * it, then the back card draws. About eight seconds end to end, with the idle
 * beat long enough that the hero is readable between passes.
 *
 * `drawActive` latches on at the FIRST sweep and stays on. The animation player
 * behind it costs a full engine boot (loop, orchestrator, canvas), so the cue
 * arms it once and then leaves it running rather than tearing it down and
 * rebuilding it every eight seconds on a marketing page. Each later sweep still
 * lands: `cycle` increments at the sweep, and the back card flares on that
 * change, so every pass reads as cause and effect.
 *
 * Reduced motion parks the whole thing: phase stays `idle`, `drawActive` stays
 * false, and the hero is two still cards with the printed mandala at full
 * strength.
 */

export type ScanCueVariant = "phone" | "pulse";

/** `rise` brings the cue in, `sweep` reads the card, `draw` is the back's turn. */
export type ScanPhase = "idle" | "rise" | "sweep" | "draw";

const PHASE_MS: Record<ScanPhase, number> = {
  idle: 2200,
  rise: 900,
  sweep: 1300,
  draw: 3600,
};

const NEXT_PHASE: Record<ScanPhase, ScanPhase> = {
  idle: "rise",
  rise: "sweep",
  sweep: "draw",
  draw: "idle",
};

export interface HeroScanTimeline {
  readonly phase: ScanPhase;
  /** True once the first sweep has armed the back card's player. Never returns
   *  to false — see the module comment. */
  readonly drawActive: boolean;
  /** Increments on every sweep, so the back card can flare per pass. */
  readonly cycle: number;
  readonly reducedMotion: boolean;
  /** Duration of the current phase, ms — the cue times its own CSS to it. */
  readonly phaseMs: number;
  start(): void;
  stop(): void;
}

export function createHeroScanTimeline(): HeroScanTimeline {
  let phase = $state<ScanPhase>("idle");
  let drawActive = $state(false);
  let cycle = $state(0);
  let reducedMotion = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let mq: MediaQueryList | null = null;
  let onMediaChange: ((e: MediaQueryListEvent) => void) | null = null;

  function clear(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(): void {
    clear();
    timer = setTimeout(() => {
      const next = NEXT_PHASE[phase];
      phase = next;
      if (next === "sweep") {
        cycle += 1;
        drawActive = true;
      }
      schedule();
    }, PHASE_MS[phase]);
  }

  function applyMotionPreference(reduce: boolean): void {
    reducedMotion = reduce;
    if (reduce) {
      clear();
      phase = "idle";
    } else if (timer === null) {
      schedule();
    }
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
    get phaseMs() {
      return PHASE_MS[phase];
    },
    start(): void {
      if (typeof window === "undefined") return;
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      onMediaChange = (e) => applyMotionPreference(e.matches);
      mq.addEventListener("change", onMediaChange);
      applyMotionPreference(mq.matches);
    },
    stop(): void {
      clear();
      if (mq && onMediaChange) mq.removeEventListener("change", onMediaChange);
      mq = null;
      onMediaChange = null;
    },
  };
}
