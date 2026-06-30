import type { Ghost2DParams } from "../translators/canvas2d-types";

/**
 * Ghost = prop onion-skin (decaying ghost trail).
 *
 * Ghost ghosts the REAL PROP SPRITE — the same graphic the engine draws live — at
 * recent past poses. The live prop (drawn at full opacity by the prop renderer)
 * is the head; Ghost lays faded copies of it behind, fading to NOTHING over a
 * short trail window, so the prop trails out behind himself and old poses vanish
 * cleanly. There is no persistent floor (that merged every faded ghost into a
 * muddy solid) — a ghost decays to zero and is pruned.
 *
 * Capture is keyed by the prop's QUANTIZED POSE (position + angle): it is
 * granularity-independent (smooth motion lives in the pose, not the step index)
 * and self-deduping (a slow/stationary prop doesn't stack ghosts; revisiting a
 * pose on the next loop just refreshes its recency, so the trail re-forms as the
 * prop passes). Only poses touched within the last `tailSec` seconds are kept, so
 * the live set — and the per-frame cost — stays small (clear + a handful of
 * blits, no shadow blur, no figure cache). The exposure wipes when the sequence
 * changes (`epoch`).
 */
export interface GhostProp {
  /** Stable per-prop id (0 blue, 1 red, …) — keeps blue/red ghosts distinct. */
  id: number;
  /** The prop sprite to blit (already colored). */
  image: CanvasImageSource;
  /** Prop center in canvas pixels. */
  centerX: number;
  centerY: number;
  /** Staff rotation in radians. */
  angle: number;
  /** Pre-scaled draw size in canvas pixels. */
  width: number;
  height: number;
  /** Horizontal mirror (asymmetric props). */
  flipped: boolean;
}

export interface GhostInput {
  /** This frame's live props (blue, red, …) to capture/ghost. */
  props: GhostProp[];
  /** Fractional playback position in steps (unused for keying; kept for parity). */
  currentStep: number;
  /** Sequence content hash — changes on sequence change → wipe the exposure. */
  epoch: string | number;
}

/** A ghost plus the time it was last passed (drives the decay). */
type GhostEntry = { g: GhostProp; seen: number };

/** Backstop cap on live ghosts — pruning normally keeps the set far below this. */
const MAX_GHOSTS = 300;

export class Ghost2DRenderer {
  private ghosts = new Map<string, GhostEntry>();
  private epoch: string | number | null = null;
  /** Accumulated playback time (seconds) — drives the decay. */
  private time = 0;

  render(
    ctx: CanvasRenderingContext2D,
    params: Ghost2DParams,
    input: GhostInput,
    deltaTime: number,
    _scale: number,
  ): void {
    const { props, epoch } = input;
    const w = ctx.canvas?.width ?? 0;
    const h = ctx.canvas?.height ?? 0;
    if (w <= 0 || h <= 0) return;

    if (epoch !== this.epoch) {
      this.ghosts.clear();
      this.epoch = epoch;
      this.time = 0;
    }
    this.time += Math.max(0, deltaTime);

    // Knob mapping:
    //   intensity → overall trail opacity (peak alpha of the freshest ghost)
    //   decay     → Persistence: how long a ghost lasts before fading out
    //   interval  → Density (0-1, higher = denser): finer pose sampling
    const intensity = Math.max(0, Math.min(1, params.intensity ?? 1));
    const tailSec = 0.2 + Math.max(0, Math.min(12, params.decay)) * 0.18;
    const tailPeak = 0.85 * intensity;
    const density = Math.max(0, Math.min(1, params.interval ?? 0.5));
    const posQuant = Math.max(4, w * 0.05 * (1 - 0.85 * density));
    const angQuant = Math.max(0.04, 0.3 * (1 - 0.85 * density));

    // Capture / refresh the current poses.
    for (const g of props) {
      if ((g.image as HTMLImageElement).complete === false) continue;
      const key =
        `${g.id}|${Math.round(g.centerX / posQuant)}|` +
        `${Math.round(g.centerY / posQuant)}|${Math.round(g.angle / angQuant)}`;
      const existing = this.ghosts.get(key);
      if (existing) existing.seen = this.time;
      else if (this.ghosts.size < MAX_GHOSTS) this.ghosts.set(key, { g: { ...g }, seen: this.time });
    }

    // Draw the decaying trail; prune anything that has fully faded.
    ctx.clearRect(0, 0, w, h);
    const prevAlpha = ctx.globalAlpha;
    try {
      for (const [key, { g, seen }] of this.ghosts) {
        const age = this.time - seen;
        if (age >= tailSec) {
          this.ghosts.delete(key);
          continue;
        }
        const alpha = tailPeak * (1 - age / tailSec);
        if (alpha <= 0.012) continue;
        this.blit(ctx, g, alpha);
      }
    } finally {
      ctx.globalAlpha = prevAlpha;
    }
  }

  /** Blit one prop sprite at its transform and the given alpha (no shadow). */
  private blit(ctx: CanvasRenderingContext2D, g: GhostProp, alpha: number): void {
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(g.centerX, g.centerY);
    ctx.rotate(g.angle);
    if (g.flipped) ctx.scale(-1, 1);
    ctx.drawImage(g.image, -g.width / 2, -g.height / 2, g.width, g.height);
    ctx.restore();
  }

  /** Reset all cross-frame state. Called on dispose + canvas clear. */
  reset(): void {
    this.ghosts.clear();
    this.epoch = null;
    this.time = 0;
  }

  dispose(): void {
    this.reset();
  }
}
