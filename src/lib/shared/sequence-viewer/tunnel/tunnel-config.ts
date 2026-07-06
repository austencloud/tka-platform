/**
 * Tunnel CONFIG — the closed primitive vocabulary for the kaleidoscope.
 *
 * A tunnel is the always-drawn base sequence plus a set of overlaid copies
 * *generated* from an orthogonal {@link TunnelConfig}. There is no named-look
 * catalog: every mandala is a point in the config space, constructed by combining
 * primitives. This replaces the old curated `LOOKS` list (see the ADR at
 * `docs/architecture/tunnel-looks.md`).
 *
 * Two kinds of primitive:
 *
 *   Symmetry generators (Fold / Mirror / Flip) grow the copy SET by group
 *   closure. They are spatial — baked once at build via `sequence-transforms.ts`.
 *   Image count = `fold * (mirror?2:1) * (flip?2:1)`.
 *
 *   Per-copy modulators (Invert / Echo / Stagger / Speed) do NOT add copies —
 *   they make arms differ from each other (a uniform modulator is a no-op).
 *   Invert/Echo are baked (they append a CopyOp to alternate arms);
 *   Stagger/Speed are sample-time (a per-copy playhead offset / rate).
 *
 * The base is ALWAYS drawn, so on-screen prop count is `imageCount * 2` (blue +
 * red per image). Nothing multiplies behind your back.
 */

/**
 * One transform applied to the base to produce a copy. Ops compose in order
 * (rotate-then-mirror ≠ mirror-then-rotate). Every kind maps 1:1 to a function in
 * `sequence-transforms.ts` — the engine adds no new transform math.
 */
export type CopyOp =
  | { kind: "rotate"; amount: number } // 45° units (1 = 45°) → rotateSequence
  | { kind: "mirror" } //                 reflection across the vertical axis → mirrorSequence
  | { kind: "flip" } //                   reflection N↔S (horizontal axis) → flipSequence
  | { kind: "invert" } //                 PRO↔ANTI + CW↔CCW (counter-rotation) → invertSequence
  | { kind: "rewind" }; //                time-reversed copy → rewindSequence

/** The orthogonal primitive set. Every tunnel is one of these. */
export interface TunnelConfig {
  /** Rotational arms (cyclic order). Grid = 8 points, so 1/2/4/8 are representable. */
  fold: number;
  /** Reflect the set across the vertical axis (dihedral). */
  mirror: boolean;
  /** Reflect the set across the horizontal axis (N↔S). */
  flip: boolean;
  /** Alternate arms motion-invert (PRO↔ANTI, opposite spin). */
  invert: boolean;
  /** Alternate arms run time-reversed. */
  echo: boolean;
  /** Arm k shows the sequence offset by k×this many steps (0 = off) — a canon. */
  staggerSteps: number;
  /** Alternate arms traverse at ½× / 2× — overlaid tempos. */
  speed: boolean;
}

/** A generated copy: baked spatial ops + its sample-time modulators. */
export interface TunnelCopy {
  ops: CopyOp[];
  staggerSteps: number;
  speed: number;
}

/** Selectable rotational folds (ascending — the ladder `clampConfig` walks). */
export const FOLD_OPTIONS = [1, 2, 4, 8];

/** Per-copy speed cycle when Speed is on (arm 1 → 2×, arm 2 → ½×, arm 3 → 1×…). */
const SPEED_CYCLE = [1, 2, 0.5];

export const DEFAULT_CONFIG: TunnelConfig = {
  // Duo (2-fold rotation) is the default — the most legible mandala, easiest to
  // read the sequence in, and the prettiest entry point.
  fold: 2,
  mirror: false,
  flip: false,
  invert: false,
  echo: false,
  staggerSteps: 0,
  speed: false,
};

/**
 * Hard image ceiling for the LIVE dock (each image = 2 props). fold8+mirror = 16
 * images (32 props) sits at the ceiling; fold4+mirror+flip = 16 too. Reduced
 * motion drops it to keep dense rings off the "less motion" path. The playground
 * (`/test/tunnel-looks`) intentionally ignores this — it studies the full gamut.
 */
export const MAX_IMAGES = 16;
export const MAX_IMAGES_RM = 4;

// Shorthand builders.
const rot = (amount: number): CopyOp => ({ kind: "rotate", amount });
const mirrorOp: CopyOp = { kind: "mirror" };
const flipOp: CopyOp = { kind: "flip" };
const invertOp: CopyOp = { kind: "invert" };
const rewindOp: CopyOp = { kind: "rewind" };

/** rotateSequence amounts (1 unit = 45°) for the arms of a fold, base excluded. */
function foldRotations(fold: number): number[] {
  if (fold <= 1) return [];
  const per = 8 / fold; // fold 2 → 4 units (180°), fold 4 → 2 (90°), fold 8 → 1 (45°)
  const out: number[] = [];
  for (let k = 1; k < fold; k++) out.push(k * per);
  return out;
}

/** Images the config draws (base included). No copies are generated. */
export function imageCount(cfg: TunnelConfig): number {
  return cfg.fold * (cfg.mirror ? 2 : 1) * (cfg.flip ? 2 : 1);
}

/** On-screen prop count: `imageCount * 2` (blue + red per image). */
export function propCount(cfg: TunnelConfig): number {
  return imageCount(cfg) * 2;
}

/**
 * The spatial op-chains for the extra copies (base excluded), in overlay order.
 * Depends only on the symmetry generators + baked modulators
 * (fold/mirror/flip/invert/echo) — NOT stagger/speed — so the live controller
 * only re-bakes when the geometry changes.
 */
export function generateCopyOps(cfg: TunnelConfig): CopyOp[][] {
  // Rotational set including identity ([] = base).
  let chains: CopyOp[][] = [[]];
  for (const a of foldRotations(cfg.fold)) chains.push([rot(a)]);
  // Reflections extend the set by closure (∪ their mirror/flip of everything so far).
  if (cfg.mirror) chains = [...chains, ...chains.map((c) => [mirrorOp, ...c])];
  if (cfg.flip) chains = [...chains, ...chains.map((c) => [flipOp, ...c])];

  const extras = chains.slice(1); // drop identity (the base is drawn separately)
  return extras.map((ops, i) => {
    const arm = i + 1; // base is arm 0
    const alt = arm % 2 === 1; // baked modulators land on alternate arms
    const out = [...ops];
    if (cfg.invert && alt) out.push(invertOp);
    if (cfg.echo && alt) out.push(rewindOp);
    return out;
  });
}

/**
 * Sample-time modulators per extra copy, aligned index-for-index with
 * {@link generateCopyOps}. Stagger accumulates by arm; Speed cycles alternate
 * arms through {@link SPEED_CYCLE}.
 */
export function copyModulators(cfg: TunnelConfig): { staggerSteps: number; speed: number }[] {
  const n = imageCount(cfg) - 1;
  const out: { staggerSteps: number; speed: number }[] = [];
  for (let i = 0; i < n; i++) {
    const arm = i + 1;
    out.push({
      staggerSteps: cfg.staggerSteps > 0 ? arm * cfg.staggerSteps : 0,
      speed: cfg.speed ? (SPEED_CYCLE[arm % SPEED_CYCLE.length] ?? 1) : 1,
    });
  }
  return out;
}

/** Full copy descriptors (ops + modulators). Used by tests + the playground. */
export function generateCopies(cfg: TunnelConfig): TunnelCopy[] {
  const ops = generateCopyOps(cfg);
  const mods = copyModulators(cfg);
  return ops.map((o, i) => {
    const m = mods[i] ?? { staggerSteps: 0, speed: 1 };
    return { ops: o, staggerSteps: m.staggerSteps, speed: m.speed };
  });
}

/**
 * Clamp the generators (Fold, then Flip, then Mirror) so the image count fits a
 * budget. Fold is walked down its ladder first (keeps both reflection axes when
 * possible); reflections drop only if fold-1 still overflows. Modulators are free
 * (they add no copies), so they are never clamped.
 */
export function clampConfig(cfg: TunnelConfig, maxImages: number): TunnelConfig {
  const out = { ...cfg };
  const foldMin = FOLD_OPTIONS[0] ?? 1;
  while (imageCount(out) > maxImages && out.fold > foldMin) {
    const i = FOLD_OPTIONS.indexOf(out.fold);
    out.fold = FOLD_OPTIONS[Math.max(0, i - 1)] ?? foldMin;
  }
  if (imageCount(out) > maxImages && out.flip) out.flip = false;
  if (imageCount(out) > maxImages && out.mirror) out.mirror = false;
  return out;
}

/**
 * Curated mandala presets — the primary surface. A preset is just a named point
 * in the config space; selecting one sets the primitives. An "anxiety-free" few,
 * each a visually distinct mandala (≤16 props). The tuner (all the primitives) is
 * the secondary surface for anyone who wants to go past these.
 */
export interface TunnelPreset {
  id: string;
  name: string;
  /** FontAwesome class for the card glyph. */
  icon: string;
  config: TunnelConfig;
}

export const TUNNEL_PRESETS: TunnelPreset[] = [
  // Duo (2-fold rotation) leads — the most legible mandala, the default look.
  { id: "duo", name: "Duo", icon: "fas fa-circle-half-stroke", config: { ...DEFAULT_CONFIG, fold: 2 } },
  { id: "radial", name: "Radial", icon: "fas fa-fan", config: { ...DEFAULT_CONFIG, fold: 4 } },
  { id: "mandala", name: "Mandala", icon: "fas fa-asterisk", config: { ...DEFAULT_CONFIG, fold: 4, mirror: true } },
  { id: "pinwheel", name: "Pinwheel", icon: "fas fa-hurricane", config: { ...DEFAULT_CONFIG, fold: 8 } },
  { id: "spiral", name: "Spiral", icon: "fas fa-circle-notch", config: { ...DEFAULT_CONFIG, fold: 4, staggerSteps: 1 } },
  { id: "inverted", name: "Inverted", icon: "fas fa-arrows-spin", config: { ...DEFAULT_CONFIG, fold: 4, invert: true } },
  { id: "cross", name: "Cross", icon: "fas fa-plus", config: { ...DEFAULT_CONFIG, fold: 2, mirror: true } },
];

function eqConfig(a: TunnelConfig, b: TunnelConfig): boolean {
  return (
    a.fold === b.fold &&
    a.mirror === b.mirror &&
    a.flip === b.flip &&
    a.invert === b.invert &&
    a.echo === b.echo &&
    a.staggerSteps === b.staggerSteps &&
    a.speed === b.speed
  );
}

/** The preset id whose config exactly matches `cfg`, or null (a custom tweak). */
export function matchPreset(cfg: TunnelConfig): string | null {
  return TUNNEL_PRESETS.find((p) => eqConfig(p.config, cfg))?.id ?? null;
}

export function getPreset(id: string): TunnelPreset | undefined {
  return TUNNEL_PRESETS.find((p) => p.id === id);
}

/** Stable short signature of a config (export filename suffix + build keying). */
export function configKey(cfg: TunnelConfig): string {
  return (
    `f${cfg.fold}` +
    (cfg.mirror ? "m" : "") +
    (cfg.flip ? "p" : "") +
    (cfg.invert ? "i" : "") +
    (cfg.echo ? "e" : "") +
    (cfg.staggerSteps > 0 ? `s${cfg.staggerSteps}` : "") +
    (cfg.speed ? "x" : "")
  );
}
