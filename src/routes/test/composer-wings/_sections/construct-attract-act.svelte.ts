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
 * The pointer runs on a human motor model, not a CSS tween: rAF-driven curved
 * paths whose duration scales with distance, eased, landing off-center like a
 * real hand. It hovers before it clicks, browses alternatives before deciding,
 * glances at the workspace to watch the sequence grow, fiddles with the turn
 * pickers mid-build, and never leaves the screen — dwells are jittered and
 * carry micro-drift so it reads as a person pondering, not a metronome.
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
// Prop tiles it can get curious about mid-play (never the already-active one —
// pressing the same prop reads as a misclick, not a decision).
const PROP_SEL = ".prop-option:not(.active)";
// Turn-picker segments it can fiddle with mid-build — always a NOT-selected
// count, so every press visibly moves the glass indicator.
const TURN_BLUE_SEL = ".turns-group.blue .segment:not(.selected)";
const TURN_RED_SEL = ".turns-group.red .segment:not(.selected)";
// The option picker's section pager (embla arrows) and its All/Continuous
// filter pill — with the full letter set the picker sections into swipe
// pages, and the ghost browses across them like a person flipping cards.
const NEXT_SEL = ".picker-pane .embla__button--next";
const FILTER_SEL = ".picker-pane .filter-toggle";
// The newest workspace cell — where a just-picked step lands. The act glances
// here after some picks, watching its sequence grow.
const CELL_SEL = ".step-cell";
// The Build another button — the act presses the REAL button when it's done
// watching, so even the cycle reset is a visible decision, not a silent jump.
const AGAIN_SEL = "[data-demo-again]";

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
}): ConstructAttractAct {
  // Tune-by-eye pacing, one place (spec §Attract loop). Most dwells are
  // jittered inline — fixed intervals read as a metronome, not a person.
  const STEP_MS = opts.stepMs ?? 1200;
  const DONE_MS = opts.doneMs ?? 2500;
  const PRESS_MS = 140;

  const ghost = $state<GhostState>({ x: 0, y: 0, pressed: false, visible: false });

  let dead = false;
  let running = false;
  let inViewport = false;

  const raw = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  // rAF with a timeout fallback: in a hidden tab requestAnimationFrame never
  // fires, which would freeze a glide mid-flight FOREVER (the visitor tabs
  // away, comes back to a dead ghost). The timeout keeps time advancing —
  // hidden-tab timers are throttled to ~1s, so a glide just completes
  // coarsely while nobody is looking.
  const frame = () =>
    new Promise<void>((r) => {
      const id = requestAnimationFrame(() => {
        clearTimeout(t);
        r();
      });
      const t = setTimeout(() => {
        cancelAnimationFrame(id);
        r();
      }, 64);
    });

  /** Sleep that dies fast on kill and idles (without advancing) offscreen. */
  async function sleep(ms: number): Promise<void> {
    const end = performance.now() + ms;
    while (!dead && performance.now() < end) {
      await raw(Math.min(120, Math.max(16, end - performance.now())));
    }
    while (!dead && !inViewport) await raw(200);
  }

  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
  const jitter = (base: number, spread: number) => base + Math.random() * spread;

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

  // ---- Human motor model ------------------------------------------------

  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /**
   * Glide the ghost to a point along a bowed quadratic-bezier path, rAF-driven,
   * with duration scaled to distance (short hops are quick, long hauls take
   * visibly longer — a straight fixed-speed tween is the #1 "that's a robot"
   * tell). Does not touch hover; callers own that.
   */
  async function glideTo(tx: number, ty: number): Promise<void> {
    if (dead) return;
    if (!ghost.visible) {
      // First appearance: materialize a hand-width away from the target and
      // make a short approach, instead of sweeping in from the panel corner.
      ghost.x = tx + jitter(60, 60);
      ghost.y = ty + jitter(70, 50);
      ghost.visible = true;
      await sleep(240);
      if (dead) return;
    }
    const sx = ghost.x;
    const sy = ghost.y;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      ghost.x = tx;
      ghost.y = ty;
      return;
    }
    const dur = Math.min(
      Math.max((240 + dist * 0.9) * jitter(0.85, 0.3), 300),
      1300,
    );
    // Bow the path sideways — human reaches curve, they don't ride rails.
    const bow =
      dist * jitter(0.05, 0.15) * (Math.random() < 0.5 ? -1 : 1);
    const cx = sx + dx / 2 + (-dy / dist) * bow;
    const cy = sy + dy / 2 + (dx / dist) * bow;
    const t0 = performance.now();
    while (!dead) {
      const t = (performance.now() - t0) / dur;
      if (t >= 1) break;
      const e = easeInOutCubic(t);
      const u = 1 - e;
      ghost.x = u * u * sx + 2 * u * e * cx + e * e * tx;
      ghost.y = u * u * sy + 2 * u * e * cy + e * e * ty;
      await frame();
      while (!dead && !inViewport) await raw(200);
    }
    if (dead) return;
    ghost.x = tx;
    ghost.y = ty;
  }

  /** A point inside an element, deliberately off exact center — landing on
   *  the mathematical centroid every time is another robot tell. */
  function aimAt(el: HTMLElement): { x: number; y: number } | null {
    const root = opts.getRoot();
    if (!root) return null;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const ox = (Math.random() - 0.5) * Math.min(r.width * 0.35, 56);
    const oy = (Math.random() - 0.5) * Math.min(r.height * 0.35, 36);
    return {
      x: r.left + r.width / 2 - rr.left + ox,
      y: r.top + r.height / 2 - rr.top + oy,
    };
  }

  /** Dwell with occasional micro-drift — a resting hand isn't frozen. Keeps
   *  whatever hover is active (the drift stays within a few px). */
  async function dwell(ms: number): Promise<void> {
    if (ms < 700 || Math.random() < 0.3) return sleep(ms);
    await sleep(ms * 0.4);
    if (dead) return;
    const ang = Math.random() * Math.PI * 2;
    const r = jitter(3, 7);
    await glideTo(ghost.x + Math.cos(ang) * r, ghost.y + Math.sin(ang) * r);
    await sleep(ms * 0.6);
  }

  /** Glide onto an element and hover it for a beat (no press). */
  async function hoverOn(el: HTMLElement, dwellMs: number): Promise<void> {
    const p = aimAt(el);
    if (!p || dead) return;
    await glideTo(p.x, p.y);
    if (dead) return;
    setHover(el);
    await dwell(dwellMs);
  }

  /** Hover, pause to commit, then press. Default: real click on a real
   *  target — programmatic click() fires no pointerdown, so the act can never
   *  trigger the section's own takeover listener. Callers pass `action` when
   *  the target's real interaction is pointer-based (the tap-to-toggle
   *  canvas) and click() wouldn't land. */
  async function moveAndPress(
    el: HTMLElement,
    action?: () => void,
  ): Promise<void> {
    await hoverOn(el, jitter(240, 420));
    if (dead) return;
    // Re-aim at press time: the glide takes up to ~1.3s and the target can
    // move under it (embla settling, grid reflow after a turns change). The
    // element reference would still click fine, but the ghost would visibly
    // press empty air where the tile USED to be. If the hand isn't on the
    // target anymore, correct like a person would — and if the target left
    // the DOM entirely, abort the press instead of ghost-clicking nothing.
    const root = opts.getRoot();
    if (root) {
      if (el.offsetParent === null) return;
      const r = el.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      const gx = ghost.x + rr.left;
      const gy = ghost.y + rr.top;
      const onTarget =
        gx >= r.left && gx <= r.right && gy >= r.top && gy <= r.bottom;
      if (!onTarget) {
        const p = aimAt(el);
        if (!p || dead) return;
        await glideTo(p.x, p.y);
        if (dead) return;
        setHover(el);
      }
    }
    ghost.pressed = true;
    await sleep(PRESS_MS);
    ghost.pressed = false;
    if (dead) return;
    if (action) action();
    else el.click();
  }

  /** Browse before deciding: hover 0–2 alternatives, then press the chosen
   *  one — the "which one do I want" moment a straight pick never has. */
  async function browseAndPick(cands: HTMLElement[]): Promise<void> {
    const pool = [...cands];
    const chosen = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!;
    const roll = Math.random();
    const looks = roll < 0.45 ? 0 : roll < 0.85 ? 1 : 2;
    for (let i = 0; i < looks && pool.length && !dead; i++) {
      const alt = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!;
      await hoverOn(alt, jitter(450, 550));
    }
    if (dead) return;
    await moveAndPress(chosen);
  }

  /** Park the ghost just inside an element's bottom-right corner (jittered) —
   *  the "hand at rest, watching" pose between actions. */
  async function restBeside(el: HTMLElement): Promise<void> {
    const root = opts.getRoot();
    if (!root || dead) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    setHover(null);
    await glideTo(
      r.right - rr.left - jitter(22, 20),
      r.bottom - rr.top - jitter(22, 20),
    );
  }

  // ---- Personality beats --------------------------------------------------

  /** Watch the just-picked step land: drift over and rest BESIDE the newest
   *  workspace cell — deliberately no hover mark, because brightening the
   *  pictograph reads as trying to click it (workspace cells aren't
   *  interactive in this demo). Looking, not pressing. */
  async function glanceAtWorkspace(): Promise<void> {
    const root = opts.getRoot();
    if (!root || dead) return;
    const cells = [...root.querySelectorAll<HTMLElement>(CELL_SEL)].filter(
      (el) => el.offsetParent !== null,
    );
    const last = cells[cells.length - 1];
    if (!last) return;
    setHover(null);
    const r = last.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    await glideTo(
      r.right - rr.left + jitter(10, 12),
      r.bottom - rr.top + jitter(6, 10),
    );
    await dwell(jitter(650, 650));
  }

  /** Flip to another letter-family page (the sections swipe like cards) —
   *  the "what else is over here" browse a person does with a pager. */
  async function pageSections(): Promise<void> {
    const next = await waitFor(NEXT_SEL, 800);
    if (!next.length || dead) return;
    await moveAndPress(next[0]!);
    await sleep(jitter(500, 400));
  }

  /** Toggle the picker's All/Continuous pill — and toggle it back if the
   *  continuous subset comes up empty for the current position, the same
   *  retreat a person makes from a filter that filtered everything out. */
  async function fiddleFilter(): Promise<void> {
    const pill = await waitFor(FILTER_SEL, 800);
    if (!pill.length || dead) return;
    await moveAndPress(pill[0]!);
    await sleep(jitter(600, 500));
    if (dead) return;
    const options = await waitFor(OPTION_SEL, 2500);
    if (!options.length && !dead) {
      const back = await waitFor(FILTER_SEL, 800);
      if (back.length) {
        await moveAndPress(back[0]!);
        await sleep(jitter(400, 300));
      }
    }
  }

  /** Mid-build curiosity: change a hand's turns (sometimes both). Every press
   *  lands on a not-selected count, so the glass indicator visibly moves —
   *  and the option grid re-derives with the new turns, a real decision with
   *  real consequences. */
  async function fiddleTurns(): Promise<void> {
    const first = Math.random() < 0.5 ? TURN_BLUE_SEL : TURN_RED_SEL;
    const segs = await waitFor(first, 1500);
    if (!segs.length || dead) return;
    await moveAndPress(pick(segs));
    await sleep(jitter(500, 500));
    if (Math.random() < 0.35 && !dead) {
      const other = first === TURN_BLUE_SEL ? TURN_RED_SEL : TURN_BLUE_SEL;
      const segs2 = await waitFor(other, 1500);
      if (segs2.length && !dead) {
        await moveAndPress(pick(segs2));
        await sleep(jitter(400, 400));
      }
    }
  }

  /** Poll the live picker DOM for visible targets (pickers load async).
   *  Candidates are hit-tested at their center — embla keeps offscreen slides
   *  in flow, so offsetParent alone would let the ghost "press" an option
   *  sitting in a clipped page and the click would land on empty air. */
  async function waitFor(selector: string, timeoutMs = 8000): Promise<HTMLElement[]> {
    const t0 = performance.now();
    while (!dead) {
      const root = opts.getRoot();
      if (root) {
        const els = [...root.querySelectorAll<HTMLElement>(selector)].filter(
          (el) => {
            if (el.offsetParent === null) return false;
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) return false;
            const probe = document.elementFromPoint(
              r.left + r.width / 2,
              r.top + r.height / 2,
            );
            return !!probe && (el.contains(probe) || probe.contains(el));
          },
        );
        if (els.length) return els;
      }
      if (performance.now() - t0 > timeoutMs) return [];
      await raw(150);
      while (!dead && !inViewport) await raw(200);
    }
    return [];
  }

  async function cycle(): Promise<void> {
    opts.resetBoard();
    await sleep(500);

    const starts = await waitFor(START_SEL);
    if (!starts.length || dead) {
      await sleep(1500);
      return;
    }
    // Even the start position gets a moment of choice.
    await browseAndPick(starts);

    // One mid-build moment (most cycles) where it reconsiders the turns, and
    // sometimes one where it plays with the All/Continuous filter.
    const turnMoment =
      Math.random() < 0.7 ? 1 + Math.floor(Math.random() * 2) : -1;
    const filterMoment =
      Math.random() < 0.35 ? Math.floor(Math.random() * opts.stepsPerCycle) : -1;

    for (let i = 0; i < opts.stepsPerCycle && !dead; i++) {
      // Full step beat BEFORE querying: the option grid reloads after every
      // pick, and this gap guarantees we never press a stale card from the
      // previous sequence state.
      await sleep(STEP_MS);
      if (i === turnMoment) await fiddleTurns();
      if (i === filterMoment) await fiddleFilter();
      // Sometimes flip to another letter-family page before choosing.
      if (Math.random() < 0.3) await pageSections();
      const options = await waitFor(OPTION_SEL);
      if (!options.length || dead) return;
      await browseAndPick(options);
      // Sometimes turn and watch the new step land in the workspace.
      if (Math.random() < 0.35 && i < opts.stepsPerCycle - 1) {
        await glanceAtWorkspace();
      }
    }

    // The payoff, played with a personality: the ghost presses Play, settles
    // in to watch, pauses the canvas to look closer, resumes, gets curious
    // and flips through a prop or two mid-playback (the whole board re-skins
    // live), watches a little more, gets bored, and presses Build another
    // itself. Every beat is a visible decision; the ghost never leaves the
    // screen, and dwell times are jittered so it reads as a person, not a
    // metronome.
    await sleep(DONE_MS / 2);
    const play = await waitFor(PLAY_SEL, 4000);
    if (!play.length || dead) return;
    await moveAndPress(play[0]!);

    const stage = await waitFor(STAGE_SEL, 4000);
    if (!stage.length || dead) return;
    await restBeside(stage[0]!);
    await dwell(jitter(2000, 1500)); // settle in, watch

    if (dead) return;
    await moveAndPress(stage[0]!, opts.togglePlayback); // pause — look closer
    await dwell(jitter(1200, 800)); // hold the freeze
    if (dead) return;
    await moveAndPress(stage[0]!, opts.togglePlayback); // resume
    await restBeside(stage[0]!);
    await dwell(jitter(1400, 1000)); // watch a little more

    // Curiosity: browse the props, decide, try one (sometimes two).
    const props = await waitFor(PROP_SEL, 2000);
    if (props.length && !dead) {
      const tries = Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < tries && !dead; i++) {
        const fresh = await waitFor(PROP_SEL, 2000);
        if (!fresh.length) break;
        await browseAndPick(fresh);
        await dwell(jitter(1400, 900)); // admire the new prop
      }
      if (dead) return;
      await restBeside(stage[0]!);
      await dwell(jitter(1000, 800));
    }

    // Bored now. Build another — pressed for real, like everything else.
    if (dead) return;
    const again = await waitFor(AGAIN_SEL, 2000);
    if (again.length) {
      await moveAndPress(again[0]!);
      await sleep(300);
    }
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
