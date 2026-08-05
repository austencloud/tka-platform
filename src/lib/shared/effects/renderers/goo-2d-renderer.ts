import type { GooParams } from "../translators/canvas2d-types";
import type { WaterPalette } from "../domain/water-palettes";
import type { EmitterTip } from "./emitter-tip";
import { emitterId } from "./emitter-tip";
import { curl2D } from "$lib/shared/3d/effects/smoke/smoke-curl-field";

/**
 * Gooey-liquid renderer for the Canvas2D backend — the "Goo" look.
 *
 * A fundamentally different ATOM from the SSFR droplet spray: instead of
 * hundreds of discrete photoreal droplets (which read as rain/specks against a
 * black void), beads of liquid are laid CONTINUOUSLY along the tip path, then
 * merged into connected luminous blobs with the metaball recipe — sum bright
 * blobs additively, then `blur(...)·contrast(...)`: blur bridges neighbours,
 * contrast snaps the soft overlap to a hard gooey edge. The result reads as
 * substance with surface tension, and it's emissive so it survives the dark
 * pictograph canvas.
 *
 * Ported from the /test/water-rethink "gooey liquid" atom prototype. Public
 * Stamps blobs through the goo overlay each frame; the overlay owns the canvas
 * and lifecycle (see GooOverlayRenderer).
 */

const TAU = Math.PI * 2;
const PX_PER_WORLD = 60;

/** Metaball look constants. */
const BLUR_PX = 10;
const CONTRAST = 14;
const GLOW_ALPHA = 0.16;
const GRAVITY_PX = 32;
const MAX_BLOBS = 560;
/**
 * Pre-contrast brightness for the eroded pass. Dimming the field before the
 * threshold shrinks the region that survives it, so (outer − eroded) is a band
 * hugging the surface — the rim light that makes goo read as a wet substance.
 */
const ERODE = 0.6;

interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  r0: number;
  r1: number;
}

interface TipSample {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
}

export class Goo2DRenderer {
  private blobs: Blob[] = [];
  private lastTipPos = new Map<string, { x: number; y: number }>();
  private smoothedVelocity = new Map<string, { vx: number; vy: number }>();
  private off: HTMLCanvasElement | OffscreenCanvas | null = null;
  private offCtx:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null = null;
  private work: HTMLCanvasElement | OffscreenCanvas | null = null;
  private workCtx:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null = null;
  private offW = 0;
  private offH = 0;
  private clock = 0;

  render(
    ctx: CanvasRenderingContext2D,
    params: GooParams,
    emitters: EmitterTip[],
    dt: number,
    scale: number = 1,
  ): void {
    this.clock += dt;
    const sc = scale;
    const refSpeed = params.motionReferenceSpeed * PX_PER_WORLD * sc;
    const baseBlob = 11.5 * (0.85 + 0.6 * params.intensity) * sc;

    // 1. Per-emitter: smooth velocity + lay beads along the path travelled.
    for (const s of this.sampleTips(emitters, params, dt)) {
      const speedScalar = refSpeed > 0 ? Math.min(1, s.speed / refSpeed) : 0;
      // Where the tip was last frame — beads laid CONTINUOUSLY from there to
      // here bridge into a rivulet instead of gapped lonely dots.
      const prevX = s.x - s.vx * dt;
      const prevY = s.y - s.vy * dt;
      // Beads must land closer together than the bridge blur or the stream
      // breaks into separate beads instead of merging into a rivulet.
      const ambient = params.ambientEmission * 5;
      const motion = params.motionEmission * speedScalar * 68;
      let n = poisson((ambient + motion) * dt);
      if (this.blobs.length + n > MAX_BLOBS) n = MAX_BLOBS - this.blobs.length;
      const motionDir = s.speed > 1 ? Math.atan2(s.vy, s.vx) : 0;
      // Perpendicular to motion — beads spread sideways off the stream, not
      // backward, so the liquid sheet stays attached to the arc then breaks.
      const perp = motionDir + Math.PI / 2;
      for (let i = 0; i < n; i++) {
        const moving = s.speed > 1;
        const f = moving ? (i + Math.random()) / n : 0.5;
        const lat = (Math.random() - 0.5) * (moving ? 6 + speedScalar * 10 : 9) * sc;
        const bx = prevX + (s.x - prevX) * f + Math.cos(perp) * lat;
        const by = prevY + (s.y - prevY) * f + Math.sin(perp) * lat;
        const kick =
          (moving
            ? speedScalar * 30 * (Math.random() - 0.5)
            : (Math.random() - 0.5) * 16) * sc;
        const r0 = baseBlob * (0.92 + Math.random() * 0.42);
        this.blobs.push({
          x: bx,
          y: by,
          vx: s.vx * 0.88 + Math.cos(perp) * kick,
          vy: s.vy * 0.88 + Math.sin(perp) * kick,
          age: 0,
          maxAge: 0.6 + Math.random() * 0.5,
          r0,
          r1: r0 * 1.35,
        });
      }
    }

    // 2. Integrate: gentle gravity + advect toward curl (cohesion, no drain).
    let w = 0;
    for (let i = 0; i < this.blobs.length; i++) {
      const b = this.blobs[i]!;
      b.age += dt;
      if (b.age >= b.maxAge) continue;
      b.vy += GRAVITY_PX * sc * dt;
      const c = curl2D(b.x * (0.005 / sc), b.y * (0.005 / sc), this.clock);
      b.vx += (c.vx * 55 * sc - b.vx) * 1.1 * dt;
      b.vy += (c.vy * 55 * sc - b.vy) * 1.1 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (i !== w) this.blobs[w] = b;
      w++;
    }
    this.blobs.length = w;
    if (!this.blobs.length) return;

    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const off = this.ensureOff(W, H);
    if (!off) return;
    const p: WaterPalette = params.resolvedPalette;

    const work = this.ensureWork(W, H);
    if (!work) return;

    // 3. Sum the blobs as a GRAYSCALE density field on an opaque black
    //    offscreen. Grayscale is the whole point: thresholding a colored field
    //    binarizes each channel independently, so any overlap saturates to pure
    //    white with a fringe wherever one channel crosses first. That is what
    //    made the goo read as plasma. Threshold the density, colorize after.
    off.globalCompositeOperation = "source-over";
    off.fillStyle = "#000";
    off.fillRect(0, 0, W, H);
    off.globalCompositeOperation = "lighter";
    for (const b of this.blobs) {
      const t = b.age / b.maxAge;
      const fade = t < 0.12 ? t / 0.12 : t > 0.65 ? Math.max(0, (1 - t) / 0.35) : 1;
      if (fade <= 0.02) continue;
      const r = b.r0 + (b.r1 - b.r0) * t;
      const g = off.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`);
      g.addColorStop(0.5, `rgba(255,255,255,${0.6 * fade})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      off.fillStyle = g;
      off.beginPath();
      off.arc(b.x, b.y, r, 0, TAU);
      off.fill();
    }

    const field = this.off as CanvasImageSource;
    const workCanvas = this.work as CanvasImageSource;
    const blurPx = Math.round(BLUR_PX * sc);
    const prevFilter = ctx.filter;
    const prevComposite = ctx.globalCompositeOperation;
    const prevAlpha = ctx.globalAlpha;
    try {
      // 4. Threshold the density into connected liquid (the metaball recipe:
      //    blur bridges neighbours, contrast snaps the overlap to a hard gooey
      //    edge and crushes stray glow to black), then multiply the white
      //    silhouette by the palette body colour. Black stays black, so the
      //    tinted plate composites additively without a backing rectangle.
      work.globalCompositeOperation = "source-over";
      work.filter = `blur(${blurPx}px) contrast(${CONTRAST})`;
      work.drawImage(field, 0, 0);
      work.filter = "none";
      work.globalCompositeOperation = "multiply";
      // The deep tint carries the body. Everything here adds, so a light body
      // leaves the rim and the specular nowhere brighter to go — the interior
      // has to sit low for the surface to read.
      work.fillStyle = p.puddleTint;
      work.fillRect(0, 0, W, H);

      // Soft bloom halo under the liquid — luminous depth so the void reads lit.
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = GLOW_ALPHA;
      ctx.filter = `blur(${Math.round(26 * sc)}px)`;
      ctx.drawImage(workCanvas, 0, 0);

      // The body itself.
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.drawImage(workCanvas, 0, 0);

      // 5. Rim light. The same threshold run against a dimmed field survives
      //    over a smaller area, so outer XOR eroded is a band hugging the
      //    surface. Tinted with the palette edge and added on top of the body,
      //    it gives the wet meniscus that separates goo from a glowing shape.
      work.globalCompositeOperation = "source-over";
      work.filter = `blur(${blurPx}px) contrast(${CONTRAST})`;
      work.drawImage(field, 0, 0);
      work.globalCompositeOperation = "difference";
      work.filter = `blur(${blurPx}px) brightness(${ERODE}) contrast(${CONTRAST})`;
      work.drawImage(field, 0, 0);
      work.filter = "none";
      work.globalCompositeOperation = "multiply";
      work.fillStyle = p.edge;
      work.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.62;
      ctx.drawImage(workCanvas, 0, 0);
      ctx.globalAlpha = 1;

      // 6. Wet specular glints — tiny bright cores so it reads as liquid, not
      //    gel. Gated to strong, full-size blobs (and tinted, not white) so
      //    faded/isolated blobs don't leave orphan dots.
      const hi = hexToRgb(p.highlight);
      // A glint only belongs on liquid that actually merged. An isolated bead
      // never survives the metaball threshold, so its highlight would float in
      // the void as an orphan speck — which is exactly what it looked like.
      const neighbours = this.countNeighbours(baseBlob * 1.6);
      for (let i = 0; i < this.blobs.length; i++) {
        const b = this.blobs[i]!;
        if (neighbours[i]! < 3) continue;
        const t = b.age / b.maxAge;
        const fade = t < 0.12 ? t / 0.12 : t > 0.65 ? Math.max(0, (1 - t) / 0.35) : 1;
        const rFull = b.r0 + (b.r1 - b.r0) * t;
        if (fade < 0.92 || rFull < baseBlob * 0.85) continue;
        const r = rFull * 0.3;
        const g = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.35, 0, b.x, b.y, r);
        g.addColorStop(0, `rgba(${hi.r},${hi.g},${hi.b},${0.45 * fade})`);
        g.addColorStop(1, `rgba(${hi.r},${hi.g},${hi.b},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, TAU);
        ctx.fill();
      }
    } finally {
      ctx.filter = prevFilter;
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
    }
  }

  /**
   * Neighbours within `radius` for every blob, via a uniform grid keyed on
   * radius-sized cells — the 3x3 cell block around a blob covers its whole
   * search disc, so this stays linear instead of the O(n²) naive sweep.
   */
  private countNeighbours(radius: number): Int32Array {
    const n = this.blobs.length;
    const counts = new Int32Array(n);
    if (radius <= 0) return counts;
    const cell = radius;
    const buckets = new Map<number, number[]>();
    const key = (cx: number, cy: number) => cx * 73856093 + cy * 19349663;
    for (let i = 0; i < n; i++) {
      const b = this.blobs[i]!;
      const k = key(Math.floor(b.x / cell), Math.floor(b.y / cell));
      const list = buckets.get(k);
      if (list) list.push(i);
      else buckets.set(k, [i]);
    }
    const r2 = radius * radius;
    for (let i = 0; i < n; i++) {
      const b = this.blobs[i]!;
      const cx = Math.floor(b.x / cell);
      const cy = Math.floor(b.y / cell);
      let c = 0;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const list = buckets.get(key(cx + ox, cy + oy));
          if (!list) continue;
          for (const j of list) {
            if (j === i) continue;
            const o = this.blobs[j]!;
            const dx = o.x - b.x;
            const dy = o.y - b.y;
            if (dx * dx + dy * dy <= r2) c++;
          }
        }
      }
      counts[i] = c;
    }
    return counts;
  }

  /** Per-emitter EMA velocity smoothing, honoring trackingMode. */
  private sampleTips(
    emitters: EmitterTip[],
    params: GooParams,
    dt: number,
  ): TipSample[] {
    const out: TipSample[] = [];
    const seen = new Set<string>();
    for (const e of emitters) {
      if (!this.isEndEnabled(e.end, params)) continue;
      const id = emitterId(e.propIndex, e.tipIndex);
      seen.add(id);
      const last = this.lastTipPos.get(id);
      let vx = 0;
      let vy = 0;
      if (last && dt > 0) {
        vx = (e.x - last.x) / dt;
        vy = (e.y - last.y) / dt;
      }
      const prev = this.smoothedVelocity.get(id);
      const a = 1 - Math.pow(0.6, dt * 60);
      const svx = prev ? prev.vx + (vx - prev.vx) * a : vx;
      const svy = prev ? prev.vy + (vy - prev.vy) * a : vy;
      if (prev) { prev.vx = svx; prev.vy = svy; } else { this.smoothedVelocity.set(id, { vx: svx, vy: svy }); }
      out.push({ x: e.x, y: e.y, vx: svx, vy: svy, speed: Math.hypot(svx, svy) });
      if (last) { last.x = e.x; last.y = e.y; } else { this.lastTipPos.set(id, { x: e.x, y: e.y }); }
    }
    for (const id of this.lastTipPos.keys()) if (!seen.has(id)) this.lastTipPos.delete(id);
    for (const id of this.smoothedVelocity.keys()) if (!seen.has(id)) this.smoothedVelocity.delete(id);
    return out;
  }

  private isEndEnabled(end: "A" | "B", params: GooParams): boolean {
    if (params.trackingMode === "both_ends") return true;
    return params.trackingMode === "left_end" ? end === "A" : end === "B";
  }

  private ensureOff(
    w: number,
    h: number,
  ): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
    if (this.off && this.offW === w && this.offH === h && this.offCtx) return this.offCtx;
    const c = createOffscreen(w, h);
    if (!c) return null;
    const ctx = c.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return null;
    this.off = c;
    this.offCtx = ctx;
    this.offW = w;
    this.offH = h;
    this.work = null;
    this.workCtx = null;
    return ctx;
  }

  /** Scratch plate for the threshold + tint passes. Sized with the field. */
  private ensureWork(
    w: number,
    h: number,
  ): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
    if (this.work && this.workCtx && this.offW === w && this.offH === h) return this.workCtx;
    const c = createOffscreen(w, h);
    if (!c) return null;
    const ctx = c.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return null;
    this.work = c;
    this.workCtx = ctx;
    return ctx;
  }

  dispose(): void {
    this.blobs = [];
    this.lastTipPos.clear();
    this.smoothedVelocity.clear();
    this.off = null;
    this.offCtx = null;
    this.work = null;
    this.workCtx = null;
    this.offW = 0;
    this.offH = 0;
    this.clock = 0;
  }
}

function poisson(expected: number): number {
  let n = Math.floor(expected);
  if (Math.random() < expected - n) n++;
  return n;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const s = hex.trim().replace(/^#/, "");
  const norm = s.length === 3 ? s.split("").map((c) => c + c).join("") : s.slice(0, 6);
  return {
    r: parseInt(norm.slice(0, 2), 16),
    g: parseInt(norm.slice(2, 4), 16),
    b: parseInt(norm.slice(4, 6), 16),
  };
}

function createOffscreen(w: number, h: number): HTMLCanvasElement | OffscreenCanvas | null {
  try {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  } catch {
    /* fall through */
  }
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}
