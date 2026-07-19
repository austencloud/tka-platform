/**
 * Construct Attract Act — drives the Construct demo while nobody is touching
 * it (spec: docs/superpowers/specs/2026-07-19-construct-attract-demo-design.md).
 *
 * Named after the landing "Hero Attract Act" (hero-act.svelte.ts) — same idea,
 * different mechanism: this act performs a scripted POINTER, not sequence
 * swaps. Each cycle it taps a random start position, then 4 random valid
 * options, by querying the REAL rendered picker DOM and dispatching real
 * clicks — so the demo can only ever tap what a human could tap, and the
 * validity engine stays the single source of truth.
 *
 * Lifecycle: created once by the section (never under reduced motion),
 * started on first viewport intersection, paused while offscreen, and killed
 * permanently on takeover (first real pointerdown/focusin) or unmount.
 */

const START_SEL =
  '[data-testid="start-position-picker"] .pictograph-container[role="button"]';
const OPTION_SEL = '[data-testid="option-card"]';

export interface GhostState {
  x: number;
  y: number;
  pressed: boolean;
  visible: boolean;
}

export interface ConstructAttractAct {
  ghost: GhostState;
  /** Begin the attract loop (idempotent; no-op after kill). */
  start: () => void;
  /** Viewport gate — the loop idles between actions while not visible. */
  setVisible: (visible: boolean) => void;
  /** Permanent stop: takeover or unmount. Ghost fades out via `visible`. */
  kill: () => void;
  /** True once kill() has run — the section flips its live-region back on. */
  readonly dead: boolean;
}

export function createConstructAttractAct(opts: {
  /** The demo band — coordinate space for the ghost AND the query root. */
  getRoot: () => HTMLElement | null;
  /** Clears the section's board state (steps + start position). */
  resetBoard: () => void;
  /** Steps per cycle — matches the section's MAX_STEPS. */
  stepsPerCycle: number;
  stepMs?: number;
  doneMs?: number;
  travelMs?: number;
}): ConstructAttractAct {
  // Tune-by-eye pacing, one place (spec §Attract loop).
  const STEP_MS = opts.stepMs ?? 1600;
  const DONE_MS = opts.doneMs ?? 2500;
  const TRAVEL_MS = opts.travelMs ?? 450;
  const PRESS_MS = 140;

  const ghost = $state<GhostState>({ x: 0, y: 0, pressed: false, visible: false });

  let dead = false;
  let running = false;
  let inViewport = false;

  const raw = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  /** Sleep that dies fast on kill and idles (without advancing) offscreen. */
  async function sleep(ms: number): Promise<void> {
    const end = performance.now() + ms;
    while (!dead && performance.now() < end) {
      await raw(Math.min(120, Math.max(16, end - performance.now())));
    }
    while (!dead && !inViewport) await raw(200);
  }

  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

  /** Poll the live picker DOM for visible targets (pickers load async). */
  async function waitFor(selector: string, timeoutMs = 8000): Promise<HTMLElement[]> {
    const t0 = performance.now();
    while (!dead) {
      const root = opts.getRoot();
      if (root) {
        const els = [...root.querySelectorAll<HTMLElement>(selector)].filter(
          (el) => el.offsetParent !== null
        );
        if (els.length) return els;
      }
      if (performance.now() - t0 > timeoutMs) return [];
      await raw(150);
      while (!dead && !inViewport) await raw(200);
    }
    return [];
  }

  async function moveAndPress(el: HTMLElement): Promise<void> {
    const root = opts.getRoot();
    if (!root || dead) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    ghost.x = r.left + r.width / 2 - rr.left;
    ghost.y = r.top + r.height / 2 - rr.top;
    ghost.visible = true;
    await sleep(TRAVEL_MS + 60);
    if (dead) return;
    ghost.pressed = true;
    await sleep(PRESS_MS);
    ghost.pressed = false;
    if (dead) return;
    // Real click on a real target — programmatic click() fires no pointerdown,
    // so the act can never trigger the section's own takeover listener.
    el.click();
  }

  async function cycle(): Promise<void> {
    opts.resetBoard();
    await sleep(500);

    const starts = await waitFor(START_SEL);
    if (!starts.length || dead) {
      await sleep(1500);
      return;
    }
    await moveAndPress(pick(starts));

    for (let i = 0; i < opts.stepsPerCycle && !dead; i++) {
      // Full step beat BEFORE querying: the option grid reloads after every
      // pick, and this gap guarantees we never press a stale card from the
      // previous sequence state.
      await sleep(STEP_MS);
      const options = await waitFor(OPTION_SEL);
      if (!options.length || dead) return;
      await moveAndPress(pick(options));
    }

    // Word-emphasis moment: the section's done card is showing.
    await sleep(DONE_MS);
  }

  function start(): void {
    if (running || dead) return;
    running = true;
    void (async () => {
      while (!dead) await cycle();
    })();
  }

  return {
    ghost,
    start,
    setVisible: (visible: boolean) => {
      inViewport = visible;
    },
    kill: () => {
      dead = true;
      ghost.visible = false;
    },
    get dead() {
      return dead;
    },
  };
}
