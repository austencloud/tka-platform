/**
 * Attract Ghost — the shared motor + lifecycle layer for the composer-wings
 * attract acts (spec: docs/superpowers/specs/2026-07-19-construct-attract-demo-design.md,
 * §Generate wing).
 *
 * Extracted from construct-attract-act.svelte.ts when the Generate wing needed
 * the same ghost: everything section-AGNOSTIC lives here — the human motor
 * model (rAF-driven curved glides, distance-scaled durations, off-center
 * landings), the press gate (elementFromPoint fingertip hit-test — the ghost
 * can never click what it isn't visibly touching), hover mirroring, jittered
 * dwells with micro-drift, browse-before-pick, the hidden-tab-proof frame
 * loop, and the pause/park/resume lifecycle (takeover glides the ghost to the
 * band's corner where it becomes the clickable "watch it again" button).
 *
 * A section's act is a thin SCRIPT on top: its selectors + a cycle() of
 * personality beats, passed to start(). See construct-attract-act.svelte.ts
 * and generate-attract-act.svelte.ts.
 */

export interface GhostState {
  x: number;
  y: number;
  pressed: boolean;
  visible: boolean;
  /** Takeover pose: parked bottom-right as the clickable "watch again" button. */
  parked: boolean;
}

/** The lifecycle surface a section wires to (GhostPointer + takeover). */
export interface AttractActHandle {
  ghost: GhostState;
  /** Begin the attract loop (idempotent; no-op after kill). */
  start: () => void;
  /** Viewport gate — the loop idles between actions while not visible. */
  setVisible: (visible: boolean) => void;
  /** Takeover: abort the current beat and park the ghost as a resume button. */
  pause: () => void;
  /** Un-park: the parked ghost was clicked — demonstrate again. */
  resume: () => void;
  /** Unmount-only stop. Ghost fades out via `visible`. */
  kill: () => void;
  /** True once kill() has run. */
  readonly dead: boolean;
  /** True while paused/parked (visitor has the wheel). */
  readonly paused: boolean;
}

/** The motor + personality primitives an act script composes its cycle from. */
export interface AttractGhost extends AttractActHandle {
  /** Abort predicate for everything inside a cycle. */
  halted: () => boolean;
  /** Sleep that dies fast on abort and idles (without advancing) offscreen. */
  sleep: (ms: number, abort?: () => boolean) => Promise<void>;
  /** Dwell with occasional micro-drift — a resting hand isn't frozen. */
  dwell: (ms: number) => Promise<void>;
  /** Glide to a band-relative point (bowed path, eased, distance-scaled). */
  glideTo: (tx: number, ty: number) => Promise<void>;
  /** Glide onto an element and hover it for a beat (no press). */
  hoverOn: (el: HTMLElement, dwellMs: number) => Promise<void>;
  /** Hover, commit, press — gated on the fingertip hit-test. `action` replaces
   *  el.click() when the target's real interaction is pointer-based. */
  moveAndPress: (el: HTMLElement, action?: () => void) => Promise<void>;
  /** Hover 0–2 alternatives, then press the chosen one. */
  browseAndPick: (cands: HTMLElement[]) => Promise<void>;
  /** Rest just inside an element's bottom-right corner, hover cleared. */
  restBeside: (el: HTMLElement) => Promise<void>;
  /** Mark/unmark the element the ghost is "hovering" (.ghost-hover mirror). */
  setHover: (el: HTMLElement | null) => void;
  /** Poll the live DOM for visible, actually-hittable targets. */
  waitFor: (selector: string, timeoutMs?: number) => Promise<HTMLElement[]>;
  pick: <T>(arr: T[]) => T;
  jitter: (base: number, spread: number) => number;
}

export function createAttractGhost(opts: {
  /** The demo band — coordinate space for the ghost AND the query root. */
  getRoot: () => HTMLElement | null;
}): {
  core: AttractGhost;
  /** Wrap a cycle script into the running loop; returns the section handle. */
  run: (cycle: () => Promise<void>) => AttractActHandle;
} {
  const PRESS_MS = 140;

  const ghost = $state<GhostState>({
    x: 0,
    y: 0,
    pressed: false,
    visible: false,
    parked: false,
  });

  let dead = false;
  let stopped = false; // takeover: cycle unwinds, ghost parks until resume
  let running = false;
  let inViewport = false;

  const halted = () => dead || stopped;

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

  async function sleep(ms: number, abort: () => boolean = halted): Promise<void> {
    const end = performance.now() + ms;
    while (!abort() && performance.now() < end) {
      await raw(Math.min(120, Math.max(16, end - performance.now())));
    }
    while (!abort() && !inViewport) await raw(200);
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
   * tell). Does not touch hover; callers own that. The abort param lets the
   * park glide run while `stopped` (everything else aborts on it).
   */
  async function glide(
    tx: number,
    ty: number,
    abort: () => boolean,
  ): Promise<void> {
    if (abort()) return;
    if (!ghost.visible) {
      // First appearance: materialize a hand-width away from the target and
      // make a short approach, instead of sweeping in from the panel corner.
      ghost.x = tx + jitter(60, 60);
      ghost.y = ty + jitter(70, 50);
      ghost.visible = true;
      await sleep(240, abort);
      if (abort()) return;
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
    const bow = dist * jitter(0.05, 0.15) * (Math.random() < 0.5 ? -1 : 1);
    const cx = sx + dx / 2 + (-dy / dist) * bow;
    const cy = sy + dy / 2 + (dx / dist) * bow;
    const t0 = performance.now();
    while (!abort()) {
      const t = (performance.now() - t0) / dur;
      if (t >= 1) break;
      const e = easeInOutCubic(t);
      const u = 1 - e;
      ghost.x = u * u * sx + 2 * u * e * cx + e * e * tx;
      ghost.y = u * u * sy + 2 * u * e * cy + e * e * ty;
      await frame();
      while (!abort() && !inViewport) await raw(200);
    }
    if (abort()) return;
    ghost.x = tx;
    ghost.y = ty;
  }

  const glideTo = (tx: number, ty: number) => glide(tx, ty, halted);

  /** A point inside an element, deliberately off exact center — landing on
   *  the mathematical centroid every time is another robot tell. Returns null
   *  if the point falls outside the band: embla-style clipped content stays in
   *  flow, so an offscreen target still has a rect — following it would walk
   *  the ghost clean off the component. */
  function aimAt(el: HTMLElement): { x: number; y: number } | null {
    const root = opts.getRoot();
    if (!root) return null;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const ox = (Math.random() - 0.5) * Math.min(r.width * 0.35, 56);
    const oy = (Math.random() - 0.5) * Math.min(r.height * 0.35, 36);
    const x = r.left + r.width / 2 - rr.left + ox;
    const y = r.top + r.height / 2 - rr.top + oy;
    if (x < 0 || y < 0 || x > rr.width || y > rr.height) return null;
    return { x, y };
  }

  /** True only if the ghost's fingertip is REALLY over `el` right now — the
   *  press gate. elementFromPoint sees clipping, overlays and stacking the
   *  way a mouse does; a bare rect check does not (the off-component-click
   *  bug: a clipped embla card's rect said "on target" while the visible
   *  pixel there belonged to something else entirely). The ghost dot itself
   *  is pointer-events: none, so it never occludes the probe. */
  function fingertipOn(el: HTMLElement): boolean {
    const root = opts.getRoot();
    if (!root) return false;
    const rr = root.getBoundingClientRect();
    const probe = document.elementFromPoint(ghost.x + rr.left, ghost.y + rr.top);
    return !!probe && (probe === el || el.contains(probe));
  }

  /** Dwell with occasional micro-drift — a resting hand isn't frozen. Keeps
   *  whatever hover is active (the drift stays within a few px). */
  async function dwell(ms: number): Promise<void> {
    if (ms < 700 || Math.random() < 0.3) return sleep(ms);
    await sleep(ms * 0.4);
    if (halted()) return;
    const ang = Math.random() * Math.PI * 2;
    const r = jitter(3, 7);
    await glideTo(ghost.x + Math.cos(ang) * r, ghost.y + Math.sin(ang) * r);
    await sleep(ms * 0.6);
  }

  /** Glide onto an element and hover it for a beat (no press). */
  async function hoverOn(el: HTMLElement, dwellMs: number): Promise<void> {
    const p = aimAt(el);
    if (!p || halted()) return;
    await glideTo(p.x, p.y);
    if (halted()) return;
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
    if (halted()) return;
    // Press gate: the glide takes up to ~1.3s and the target can move under
    // it (embla settling, grid reflow after a turns change). Re-aim like a
    // person would — but the click NEVER fires unless the fingertip actually
    // hit-tests onto the target. A stale rect can say "on target" while the
    // element sits in a clipped embla page; el.click() would still select an
    // option while the ghost visibly pressed somewhere else. No hit, no click.
    for (let attempt = 0; attempt < 2 && !fingertipOn(el); attempt++) {
      if (el.offsetParent === null) return;
      const p = aimAt(el);
      if (!p || halted()) return;
      await glideTo(p.x, p.y);
      if (halted()) return;
      setHover(el);
      // Let a mid-settle target come to rest before the re-probe.
      await sleep(120);
      if (halted()) return;
    }
    if (!fingertipOn(el)) return;
    ghost.pressed = true;
    await sleep(PRESS_MS);
    ghost.pressed = false;
    if (halted()) return;
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
    for (let i = 0; i < looks && pool.length && !halted(); i++) {
      const alt = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!;
      await hoverOn(alt, jitter(450, 550));
    }
    if (halted()) return;
    await moveAndPress(chosen);
  }

  /** Park the ghost just inside an element's bottom-right corner (jittered) —
   *  the "hand at rest, watching" pose between actions. */
  async function restBeside(el: HTMLElement): Promise<void> {
    const root = opts.getRoot();
    if (!root || halted()) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    setHover(null);
    await glideTo(
      r.right - rr.left - jitter(22, 20),
      r.bottom - rr.top - jitter(22, 20),
    );
  }

  /** Poll the live DOM for visible targets (pickers load async). Candidates
   *  are hit-tested at their center — clipped-but-in-flow content (embla
   *  pages) would otherwise let the ghost "press" a target sitting under
   *  something else and the click would land on empty air. */
  async function waitFor(selector: string, timeoutMs = 8000): Promise<HTMLElement[]> {
    const t0 = performance.now();
    while (!halted()) {
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
      while (!halted() && !inViewport) await raw(200);
    }
    return [];
  }

  /** Takeover pose: glide to the band's bottom-right corner and sit there as
   *  the clickable "watch it again" button until resume() or kill(). The
   *  glide ignores `stopped` (it IS the stopped pose) but respects kill. */
  async function parkAndWait(): Promise<void> {
    setHover(null);
    ghost.pressed = false;
    const root = opts.getRoot();
    if (root) {
      const rr = root.getBoundingClientRect();
      await glide(rr.width - 32, rr.height - 32, () => dead);
    }
    ghost.visible = true;
    ghost.parked = true;
    while (!dead && stopped) await raw(150);
    ghost.parked = false;
  }

  const handle: AttractActHandle = {
    ghost,
    start: () => {}, // replaced by run() — an act without a cycle can't start
    setVisible: (visible: boolean) => {
      inViewport = visible;
    },
    pause: () => {
      stopped = true;
    },
    resume: () => {
      stopped = false;
    },
    kill: () => {
      dead = true;
      setHover(null);
      ghost.visible = false;
    },
    get dead() {
      return dead;
    },
    get paused() {
      return stopped;
    },
  };

  const core: AttractGhost = {
    ...handle,
    // Spread drops the getters (they evaluate once) — restore them.
    get dead() {
      return dead;
    },
    get paused() {
      return stopped;
    },
    halted,
    sleep,
    dwell,
    glideTo,
    hoverOn,
    moveAndPress,
    browseAndPick,
    restBeside,
    setHover,
    waitFor,
    pick,
    jitter,
  };

  function run(cycle: () => Promise<void>): AttractActHandle {
    const start = () => {
      if (running || dead) return;
      running = true;
      void (async () => {
        while (!dead) {
          if (stopped) {
            await parkAndWait();
            continue;
          }
          // A transient DOM race must never silently kill the loop — that is
          // how a ghost "just disappears". Swallow, breathe, try again.
          try {
            await cycle();
          } catch {
            await raw(800);
          }
        }
      })();
    };
    handle.start = start;
    core.start = start;
    return handle;
  }

  return { core, run };
}
