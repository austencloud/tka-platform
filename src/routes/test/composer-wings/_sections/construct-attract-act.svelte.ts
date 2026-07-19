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
// The option grid renders OptionCard ("option-card") on the wide desktop layout
// and OptionViewerSection tiles ("option-item") on the swipe/fallback layouts —
// the demo pane uses the fallback, so the act must match BOTH. (Matching only
// option-card was the bug that froze the act at step 0: waitFor timed out every
// cycle and the loop restarted from the start position forever.)
const OPTION_SEL = '[data-testid="option-card"], [data-testid="option-item"]';
// The section's canonical green play button (ViewSequenceButton inside the
// [data-demo-play] slot) — the act presses it after the last step so every
// attract cycle ends on the real payoff: the sequence animating.
const PLAY_SEL = "[data-demo-play] button";
// The play-phase canvas stage. The act "taps" it mid-playback to pause and
// resume — teaching the tap-to-toggle interaction by demonstrating it.
const STAGE_SEL = "[data-demo-stage]";

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
  /**
   * Toggles the player's playback (AnimationPlayer's onTogglePlaybackRef fn).
   * The real tap-to-toggle listens for POINTER events, and the act must never
   * dispatch synthetic pointerdown (that would trip the section's takeover
   * capture listener) — so the ghost performs the press visually and this
   * callback performs the toggle.
   */
  togglePlayback: () => void;
  /** Steps per cycle — matches the section's MAX_STEPS. */
  stepsPerCycle: number;
  stepMs?: number;
  doneMs?: number;
  travelMs?: number;
  playMs?: number;
}): ConstructAttractAct {
  // Tune-by-eye pacing, one place (spec §Attract loop).
  const STEP_MS = opts.stepMs ?? 1600;
  const DONE_MS = opts.doneMs ?? 2500;
  const TRAVEL_MS = opts.travelMs ?? 450;
  const PRESS_MS = 140;
  // How long the act lets the built sequence animate before the next cycle.
  const PLAY_MS = opts.playMs ?? 7000;

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

  // The element the ghost is currently "hovering". Since a fake pointer can't
  // trigger CSS :hover, the act marks its target with a .ghost-hover class and
  // the section mirrors the real hover styles onto it — so buttons scale, the
  // canvas shows its pause/play badge, and the ghost reads as a real hand.
  let hovered: HTMLElement | null = null;
  function setHover(el: HTMLElement | null): void {
    if (hovered === el) return;
    hovered?.classList.remove("ghost-hover");
    hovered = el;
    hovered?.classList.add("ghost-hover");
  }

  /** Glide the ghost to a resting point (no press, no hover target). */
  async function moveTo(x: number, y: number): Promise<void> {
    setHover(null);
    ghost.x = x;
    ghost.y = y;
    ghost.visible = true;
    await sleep(TRAVEL_MS + 60);
  }

  /** Park the ghost just inside an element's bottom-right corner — the "hand
   *  at rest, watching" pose between actions. */
  async function restBeside(el: HTMLElement): Promise<void> {
    const root = opts.getRoot();
    if (!root || dead) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    await moveTo(r.right - rr.left - 30, r.bottom - rr.top - 30);
  }

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

  async function moveAndPress(
    el: HTMLElement,
    action?: () => void,
  ): Promise<void> {
    const root = opts.getRoot();
    if (!root || dead) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    ghost.x = r.left + r.width / 2 - rr.left;
    ghost.y = r.top + r.height / 2 - rr.top;
    ghost.visible = true;
    await sleep(TRAVEL_MS + 60);
    if (dead) return;
    setHover(el);
    ghost.pressed = true;
    await sleep(PRESS_MS);
    ghost.pressed = false;
    if (dead) return;
    // Default: real click on a real target — programmatic click() fires no
    // pointerdown, so the act can never trigger the section's own takeover
    // listener. Callers pass `action` when the target's real interaction is
    // pointer-based (the tap-to-toggle canvas) and click() wouldn't land.
    if (action) action();
    else el.click();
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

    // The payoff: press Play, let the sequence animate, then DEMONSTRATE the
    // tap-to-toggle interaction — tap the canvas to pause, hold the freeze,
    // tap again to resume — before the next cycle. Visitors learn the canvas
    // is tappable by watching it happen. The ghost NEVER hides mid-cycle:
    // between actions it parks beside the stage like a hand at rest, so the
    // whole loop reads as one person continuously using the toy.
    await sleep(DONE_MS / 2);
    const play = await waitFor(PLAY_SEL, 4000);
    if (!play.length || dead) return;
    await moveAndPress(play[0]!);

    const stage = await waitFor(STAGE_SEL, 4000);
    if (!stage.length || dead) return;
    await restBeside(stage[0]!);
    await sleep(PLAY_MS * 0.45);
    if (dead) return;
    await moveAndPress(stage[0]!, opts.togglePlayback); // pause
    await sleep(1400); // hold the freeze — a visible, deliberate decision
    if (dead) return;
    await moveAndPress(stage[0]!, opts.togglePlayback); // resume
    await restBeside(stage[0]!);
    await sleep(PLAY_MS * 0.55);
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
      setHover(null);
      ghost.visible = false;
    },
    get dead() {
      return dead;
    },
  };
}
