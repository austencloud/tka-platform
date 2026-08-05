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
const GRAVITY_PX = 26;
const MAX_BLOBS = 900;
/** Bead spacing as a fraction of bead radius. Must stay under ~1 or the blur
 *  cannot bridge neighbours and the stream reads as separate beads. */
const BEAD_SPACING = 0.7;
/** Per-emitter, per-frame ceiling so a teleporting tip can't spike the count. */
const MAX_PER_FRAME = 14;
/** Fraction of tip velocity a fresh bead carries. */
const VELOCITY_INHERIT = 0.22;
/**
 * Pre-contrast brightness for the eroded pass. Dimming the field before the
 * threshold shrinks the region that survives it, so (outer − eroded) is a band
 * hugging the surface — the rim light that makes goo read as a wet substance.
 */
const ERODE = 0.8;
/** Second, deeper threshold — the innermost of the three nested regions. */
const ERODE_DEEP = 0.62;

interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  r0: number;
  r1: number;
  /** Stable per-bead flag: only a minority carry a glint, so highlights read as
   *  sparse points on a surface rather than lint suspended through the gel. */
  glint: boolean;
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
      // Where the tip was last frame. Beads are laid along that span — but the
      // COUNT comes from the DISTANCE covered, not from elapsed time. A
      // per-second rate drops the same handful of beads whether the tip crawled
      // 3px or flew 60px, so at speed the spacing outruns the bridge blur and
      // the stream shatters into islands. Per-distance emission keeps the gap
      // fixed at any speed, which is what makes it read as connected liquid.
      const prevX = s.x - s.vx * dt;
      const prevY = s.y - s.vy * dt;
      const travelled = Math.hypot(s.x - prevX, s.y - prevY);
      const spacing = baseBlob * BEAD_SPACING;
      const moving = s.speed > 1;
      const alongPath = moving ? Math.ceil(travelled / spacing) : 0;
      const ambient = poisson(params.ambientEmission * 5 * dt);
      let n = Math.max(alongPath, ambient);
      // Emission knob scales the stream without letting it thin into gaps.
      if (moving) n = Math.max(alongPath, Math.round(n * (0.55 + params.motionEmission * 0.75)));
      n = Math.min(n, MAX_PER_FRAME);
      if (this.blobs.length + n > MAX_BLOBS) n = Math.max(0, MAX_BLOBS - this.blobs.length);
      const motionDir = moving ? Math.atan2(s.vy, s.vx) : 0;
      // Perpendicular to motion — beads spread sideways off the stream, not
      // backward, so the liquid sheet stays attached to the arc then breaks.
      const perp = motionDir + Math.PI / 2;
      for (let i = 0; i < n; i++) {
        const f = moving ? (i + Math.random()) / n : 0.5;
        const lat = (Math.random() - 0.5) * (moving ? 3 + speedScalar * 5 : 7) * sc;
        const bx = prevX + (s.x - prevX) * f + Math.cos(perp) * lat;
        const by = prevY + (s.y - prevY) * f + Math.sin(perp) * lat;
        const kick =
          (moving
            ? speedScalar * 12 * (Math.random() - 0.5)
            : (Math.random() - 0.5) * 10) * sc;
        const r0 = baseBlob * (0.92 + Math.random() * 0.42);
        this.blobs.push({
          x: bx,
          y: by,
          // Beads keep only a little of the tip's velocity. Inheriting most of
          // it launched the whole mass off the arc it was laid on.
          vx: s.vx * VELOCITY_INHERIT + Math.cos(perp) * kick,
          vy: s.vy * VELOCITY_INHERIT + Math.sin(perp) * kick,
          age: 0,
          maxAge: 0.46 + Math.random() * 0.4,
          r0,
          // Beads SHRINK as they age. Growing them gave the tail a blunt cap
          // that vanished on alpha alone; shrinking lets the far end fall under
          // the metaball threshold gradually, so the ribbon necks down and
          // pinches off into droplets the way surface tension actually ends a
          // stream.
          r1: r0 * 0.62,
          glint: Math.random() < 0.3,
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
      // Curl is surface wobble, not transport. At the old strength it pulled
      // beads apart faster than they were laid, so the ribbon came apart into
      // islands between one frame and the next.
      const c = curl2D(b.x * (0.005 / sc), b.y * (0.005 / sc), this.clock);
      b.vx += (c.vx * 22 * sc - b.vx) * 0.5 * dt;
      b.vy += (c.vy * 22 * sc - b.vy) * 0.5 * dt;
      // Viscous drag — goo settles instead of coasting away from its stream.
      const damp = Math.pow(0.12, dt);
      b.vx *= damp;
      b.vy *= damp;
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
      const fade = beadFade(t);
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

      // 5. Depth grading. Thresholding the same field at three levels nests
      //    three regions — outer ⊃ shallow ⊃ deep — and the rings between them
      //    are the liquid's cross-section. Painting the outermost ring brightest
      //    and leaving the innermost as bare body colour reads as thickness:
      //    light gets through the thin edges and is absorbed by the mass.
      //    Everything composites additively, so depth has to be built by adding
      //    LESS toward the middle, never by painting the middle darker.
      //
      //    The rim ring is cut with the shallow mask pushed AWAY from the light,
      //    which widens the band on the lit side and closes it on the far side.
      //    A rim of even width all the way round is lit from everywhere, which
      //    is to say from nowhere; a crescent is what reads as wet.
      const lightPush = Math.max(1, Math.round(blurPx * 0.5));
      this.drawBand(work, field, W, H, blurPx, 1, ERODE, lightPush, p.edge);
      ctx.globalAlpha = 0.62;
      ctx.drawImage(workCanvas, 0, 0);

      this.drawBand(work, field, W, H, blurPx, ERODE, ERODE_DEEP, 0, p.core);
      ctx.globalAlpha = 0.4;
      ctx.drawImage(workCanvas, 0, 0);
      ctx.globalAlpha = 1;

      // 6. Wet specular glints. Every highlight sits at the SAME offset from its
      //    bead — up and to the left — so they agree on where the light is.
      //    Scattered at random depths they read as lint suspended in the gel;
      //    agreeing on a light direction is what makes a surface.
      const hi = hexToRgb(p.highlight);
      // A glint also only belongs on liquid that actually merged (an isolated
      // bead never survives the threshold, so its highlight would float in the
      // void) and near the SURFACE — deeply buried beads are under the goo, not
      // on it. The neighbour count gives both tests.
      const neighbours = this.countNeighbours(baseBlob * 1.7);
      for (let i = 0; i < this.blobs.length; i++) {
        const b = this.blobs[i]!;
        if (!b.glint) continue;
        const nb = neighbours[i]!;
        if (nb < 4 || nb > 14) continue;
        const t = b.age / b.maxAge;
        const fade = beadFade(t);
        const rFull = b.r0 + (b.r1 - b.r0) * t;
        if (fade < 0.9 || rFull < baseBlob * 0.85) continue;
        const r = rFull * 0.22;
        const gx = b.x - rFull * 0.3;
        const gy = b.y - rFull * 0.34;
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        g.addColorStop(0, `rgba(${hi.r},${hi.g},${hi.b},${0.5 * fade})`);
        g.addColorStop(1, `rgba(${hi.r},${hi.g},${hi.b},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(gx, gy, r, 0, TAU);
        ctx.fill();
      }
    } finally {
      ctx.filter = prevFilter;
      ctx.globalCompositeOperation = prevComposite;
      ctx.globalAlpha = prevAlpha;
    }
  }

  /**
   * Leave `work` holding one tinted ring: the density field thresholded at
   * `outerLevel` minus the same field thresholded at `innerLevel`, with the
   * inner mask displaced by `push` px down-right. Both masks are white-on-black,
   * so `difference` gives the ring and `multiply` colours it — black elsewhere,
   * which composites additively without needing a backing plate.
   */
  private drawBand(
    work: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    field: CanvasImageSource,
    w: number,
    h: number,
    blurPx: number,
    outerLevel: number,
    innerLevel: number,
    push: number,
    tint: string,
  ): void {
    work.globalCompositeOperation = "source-over";
    work.filter = `blur(${blurPx}px) brightness(${outerLevel}) contrast(${CONTRAST})`;
    work.drawImage(field, 0, 0);
    work.globalCompositeOperation = "difference";
    work.filter = `blur(${blurPx}px) brightness(${innerLevel}) contrast(${CONTRAST})`;
    work.drawImage(field, push, push);
    work.filter = "none";
    work.globalCompositeOperation = "multiply";
    work.fillStyle = tint;
    work.fillRect(0, 0, w, h);
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

/**
 * Bead opacity over its life. The plateau runs long because the TAPER is now
 * carried by the shrinking radius — fading alpha at the same time would erase
 * the tail before it had a chance to neck down.
 */
function beadFade(t: number): number {
  if (t < 0.12) return t / 0.12;
  if (t > 0.8) return Math.max(0, (1 - t) / 0.2);
  return 1;
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
