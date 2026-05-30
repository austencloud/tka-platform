/**
 * Image parity diff utilities. Pure RGBA-buffer math (unit-testable without a
 * DOM canvas) plus thin canvas wrappers used by the parity test pages. Extracted
 * from the inline copies in card-back-parity and trail-export-parity.
 */

/** Per-channel delta below which a pixel is considered a match (anti-aliasing). */
export const AA_TOLERANCE = 8;

/** Full-frame diff: % of pixels over tolerance + worst single-channel delta. */
export function diffBuffers(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  w: number,
  h: number,
  tol: number = AA_TOLERANCE,
): { diffPct: number; maxDelta: number } {
  const total = w * h;
  let differing = 0;
  let maxDelta = 0;
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i]! - b[i]!);
    const dg = Math.abs(a[i + 1]! - b[i + 1]!);
    const db = Math.abs(a[i + 2]! - b[i + 2]!);
    const da = Math.abs(a[i + 3]! - b[i + 3]!);
    const worst = Math.max(dr, dg, db, da);
    if (worst > maxDelta) maxDelta = worst;
    if (worst > tol) differing++;
  }
  return { diffPct: total ? (differing / total) * 100 : 0, maxDelta };
}

export interface BodyDiffOptions {
  tol?: number;
  /** Neighbor luma jump that marks an edge in the reference. */
  edgeLumaThresh?: number;
  /** px halo dilated around detected edges to also exclude. */
  edgeDilate?: number;
}

/**
 * Body-only diff: exclude high-contrast EDGES of the reference (a) — where lossy
 * codecs always fringe — and measure divergence on the remaining interior. Near
 * zero ⇒ body parity is exact and residual is purely edge fringe.
 */
export function bodyDiffBuffers(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  w: number,
  h: number,
  opts: BodyDiffOptions = {},
): { bodyDiffPct: number; bodyMaxDelta: number; edgePct: number } {
  const tol = opts.tol ?? AA_TOLERANCE;
  const edgeLumaThresh = opts.edgeLumaThresh ?? 48;
  const edgeDilate = opts.edgeDilate ?? 2;
  const n = w * h;

  const luma = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    luma[p] = 0.299 * a[i]! + 0.587 * a[i + 1]! + 0.114 * a[i + 2]!;
  }

  let edge = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const l = luma[p]!;
      let isEdge = 0;
      if (x > 0 && Math.abs(l - luma[p - 1]!) > edgeLumaThresh) isEdge = 1;
      else if (x < w - 1 && Math.abs(l - luma[p + 1]!) > edgeLumaThresh) isEdge = 1;
      else if (y > 0 && Math.abs(l - luma[p - w]!) > edgeLumaThresh) isEdge = 1;
      else if (y < h - 1 && Math.abs(l - luma[p + w]!) > edgeLumaThresh) isEdge = 1;
      edge[p] = isEdge;
    }
  }

  for (let d = 0; d < edgeDilate; d++) {
    const next = new Uint8Array(edge);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (edge[p]) continue;
        if (
          (x > 0 && edge[p - 1]) ||
          (x < w - 1 && edge[p + 1]) ||
          (y > 0 && edge[p - w]) ||
          (y < h - 1 && edge[p + w])
        )
          next[p] = 1;
      }
    }
    edge = next;
  }

  let edgeCount = 0;
  let bodyCount = 0;
  let differing = 0;
  let bodyMaxDelta = 0;
  for (let p = 0; p < n; p++) {
    if (edge[p]) {
      edgeCount++;
      continue;
    }
    bodyCount++;
    const i = p * 4;
    const worst = Math.max(
      Math.abs(a[i]! - b[i]!),
      Math.abs(a[i + 1]! - b[i + 1]!),
      Math.abs(a[i + 2]! - b[i + 2]!),
    );
    if (worst > bodyMaxDelta) bodyMaxDelta = worst;
    if (worst > tol) differing++;
  }
  return {
    bodyDiffPct: bodyCount ? (differing / bodyCount) * 100 : 0,
    bodyMaxDelta,
    edgePct: (edgeCount / n) * 100,
  };
}

// ── Canvas wrappers ─────────────────────────────────────────────────────────

function ctxData(c: HTMLCanvasElement, w: number, h: number): Uint8ClampedArray {
  return c.getContext("2d")!.getImageData(0, 0, w, h).data;
}

/** Full-frame diff + a red heatmap canvas (red where Δ > tolerance). */
export function diff(
  refC: HTMLCanvasElement,
  decC: HTMLCanvasElement,
  w: number,
  h: number,
): { diffPct: number; maxDelta: number; heat: HTMLCanvasElement } {
  const a = ctxData(refC, w, h);
  const b = ctxData(decC, w, h);
  const { diffPct, maxDelta } = diffBuffers(a, b, w, h);

  const heat = document.createElement("canvas");
  heat.width = w;
  heat.height = h;
  const hctx = heat.getContext("2d")!;
  const out = hctx.createImageData(w, h);
  for (let i = 0; i < a.length; i += 4) {
    const worst = Math.max(
      Math.abs(a[i]! - b[i]!),
      Math.abs(a[i + 1]! - b[i + 1]!),
      Math.abs(a[i + 2]! - b[i + 2]!),
    );
    if (worst > AA_TOLERANCE) {
      out.data[i] = 255;
      out.data[i + 1] = 0;
      out.data[i + 2] = 0;
      out.data[i + 3] = 255;
    } else {
      const g = (a[i]! + a[i + 1]! + a[i + 2]!) / 3;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = g * 0.4;
      out.data[i + 3] = 255;
    }
  }
  hctx.putImageData(out, 0, 0);
  return { diffPct, maxDelta, heat };
}

/** Edge-masked body diff on two canvases. */
export function bodyDiff(
  refC: HTMLCanvasElement,
  decC: HTMLCanvasElement,
  w: number,
  h: number,
  opts?: BodyDiffOptions,
): { bodyDiffPct: number; bodyMaxDelta: number; edgePct: number } {
  return bodyDiffBuffers(ctxData(refC, w, h), ctxData(decC, w, h), w, h, opts);
}

/**
 * Composite an RGBA buffer over opaque black into a fresh canvas (mirrors the
 * alpha-drop an H.264/AV1 encoder applies).
 */
export function flattenToCanvas(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): HTMLCanvasElement {
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d")!;
  const img = tctx.createImageData(w, h);
  img.data.set(data);
  tctx.putImageData(img, 0, 0);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(tmp, 0, 0); // source-over blends straight alpha over black
  return out;
}

/** Draw any image source onto a fresh w×h canvas (size normalization). */
export function normalizeToCanvas(
  src: CanvasImageSource,
  w: number,
  h: number,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(src, 0, 0, w, h);
  return out;
}
