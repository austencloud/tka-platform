// ─────────────────────────────────────────────────────────────────────────────
// Pictograph Stylize - recolor the canonical pictograph render into each era's
// palette and apply an era-specific edge treatment.
//
// Pipeline (per navigation, per era):
//   const styled = PictographStylize.recolor(canonicalBitmap, palette, size);
//   PictographStylize.edgeTreatment(styled, "pigment", rng);  // optional
//   ctx.drawImage(styled, cx - d/2, cy - d/2, d, d);
//
// The canonical render is produced once per pictograph by Canvas2DDirectRenderer
// at ~500px. Each era transforms it into its own look without reinventing
// arrow positioning, turns indicators, or motion-type distinctions (pro vs
// anti, dash, float, hash) - those all come for free from the canonical.
//
// Pixel classification matches SvgToBrailleConverter:
//   blue dominance  > 1.4× red & green  → blue class
//   red dominance   > 1.4× green & blue → red class
//   transparent / very dark              → background
//   otherwise (white / grey)             → structural
// ─────────────────────────────────────────────────────────────────────────────

(function (global) {
  const BRIGHTNESS_FLOOR = 60;
  const DOMINANCE = 1.4;
  const ALPHA_FLOOR = 30;

  function parseHex(hex) {
    if (!hex || typeof hex !== "string") return { r: 255, g: 255, b: 255 };
    const h = hex.replace("#", "");
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
      };
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  /**
   * Classify one pixel.  Returns "blue" | "red" | "structural" | "bg".
   */
  function classify(r, g, b, a) {
    if (a < ALPHA_FLOOR) return "bg";
    const bright = Math.max(r, g, b);
    if (bright < BRIGHTNESS_FLOOR) return "bg";
    if (b > r * DOMINANCE && b > g * DOMINANCE) return "blue";
    if (r > g * DOMINANCE && r > b * DOMINANCE) return "red";
    return "structural";
  }

  /**
   * Pixelate: downsample source to `chunkSize` with bilinear, then upsample
   * back to `finalSize` with nearest-neighbor. Produces the chunky, pigment-
   * coarse look you get when a clean SVG is forced through a low-resolution
   * medium. Returns HTMLCanvasElement.
   */
  function pixelate(source, finalSize, chunkSize) {
    const tmp = document.createElement("canvas");
    tmp.width = chunkSize;
    tmp.height = chunkSize;
    const tctx = tmp.getContext("2d");
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = "high";
    tctx.drawImage(source, 0, 0, chunkSize, chunkSize);

    const out = document.createElement("canvas");
    out.width = finalSize;
    out.height = finalSize;
    const octx = out.getContext("2d");
    octx.imageSmoothingEnabled = false; // nearest neighbor upsample
    octx.drawImage(tmp, 0, 0, finalSize, finalSize);
    return out;
  }

  /**
   * Recolor the canonical pictograph into the given palette, preserving
   * brightness (so anti-aliased edges stay smooth) and alpha.
   *
   * palette = { blue: "#hex", red: "#hex", structural: "#hex", bg: "#hex" | null }
   * If bg is null/undefined, background pixels stay transparent.
   *
   * Returns a new HTMLCanvasElement of size × size.
   */
  function recolor(sourceBitmap, palette, size) {
    const out = document.createElement("canvas");
    out.width = size;
    out.height = size;
    const ctx = out.getContext("2d");

    if (!sourceBitmap) return out;

    // Draw canonical scaled to output size first, then read pixels.
    ctx.drawImage(sourceBitmap, 0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;

    const pBlue = parseHex(palette.blue);
    const pRed = parseHex(palette.red);
    const pStruct = parseHex(palette.structural);
    const pBg = palette.bg ? parseHex(palette.bg) : null;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      const cls = classify(r, g, b, a);

      if (cls === "bg") {
        if (pBg) {
          d[i]     = pBg.r;
          d[i + 1] = pBg.g;
          d[i + 2] = pBg.b;
          d[i + 3] = 255;
        } else {
          d[i + 3] = 0;
        }
        continue;
      }

      // Preserve luminance of the source pixel so anti-aliased edges
      // blend into the era's palette smoothly.
      const srcL = Math.max(r, g, b) / 255;
      const target =
        cls === "blue" ? pBlue :
        cls === "red"  ? pRed  :
                         pStruct;

      d[i]     = Math.round(target.r * srcL);
      d[i + 1] = Math.round(target.g * srcL);
      d[i + 2] = Math.round(target.b * srcL);
      d[i + 3] = a;
    }

    ctx.putImageData(img, 0, 0);
    return out;
  }

  // ─── Edge treatments ────────────────────────────────────────────────────
  //
  // All treatments MUTATE the given canvas in place. They're applied AFTER
  // recolor. Each treatment reads and writes the same ImageData.

  // Smooth pseudo-noise for displacement fields. Cheap (no Perlin setup), looks
  // plausibly organic at moderate scales. Returns value in [-1, 1].
  function smoothNoise(x, y) {
    return (
      Math.sin(x * 0.031 + y * 0.017) * 0.5 +
      Math.cos(x * 0.073 - y * 0.091) * 0.3 +
      Math.sin(x * 0.19  + y * 0.21 + 4.3) * 0.2
    );
  }

  /**
   * Heavy pigment treatment: displaces pixels along a smooth noise field so
   * edges wobble like wet pigment, varies alpha so strokes have "thickness"
   * variation, and sprinkles occasional opaque flecks where pigment pooled.
   * Operates in place on the given canvas.
   */
  function treatPigment(canvas, rng) {
    rng = rng || Math.random;
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(img.data);
    const d = img.data;

    const DISPLACEMENT = 6; // max px a pixel can be shifted

    // Pass 1: sample each pixel from a noise-displaced neighbor. Edges wobble,
    // interior pigment redistributes slightly, thin strokes get chunky.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dx = smoothNoise(x, y) * DISPLACEMENT;
        const dy = smoothNoise(x + 913, y + 541) * DISPLACEMENT;
        const sx = Math.min(w - 1, Math.max(0, Math.round(x + dx)));
        const sy = Math.min(h - 1, Math.max(0, Math.round(y + dy)));
        const si = (sy * w + sx) * 4;
        d[i]     = src[si];
        d[i + 1] = src[si + 1];
        d[i + 2] = src[si + 2];
        d[i + 3] = src[si + 3];
      }
    }

    // Pass 2: pigment thickness variation. Multiply alpha by a per-pixel
    // noise value so strokes look like they have uneven coverage.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 20) continue;
        const n = smoothNoise(x * 0.8 + 17, y * 0.8 + 23) * 0.5 + 0.5; // [0,1]
        const alphaScale = 0.55 + n * 0.6; // [0.55, 1.15]
        d[i + 3] = Math.min(255, Math.max(0, d[i + 3] * alphaScale));
      }
    }

    // Pass 3: deterministic fleck speckles where pigment pooled. Scatter
    // darker specks on top of painted pixels using rng so each pictograph
    // gets unique but reproducible scatter.
    const fleckCount = Math.floor(w * h * 0.002);
    for (let k = 0; k < fleckCount; k++) {
      const fx = (rng() * w) | 0;
      const fy = (rng() * h) | 0;
      const fi = (fy * w + fx) * 4;
      if (d[fi + 3] < 80) continue;
      // Darken this pixel's color by 30%
      d[fi]     = (d[fi]     * 0.7) | 0;
      d[fi + 1] = (d[fi + 1] * 0.7) | 0;
      d[fi + 2] = (d[fi + 2] * 0.7) | 0;
    }

    ctx.putImageData(img, 0, 0);
  }

  function treatFlat(canvas) {
    // Collapse anti-aliasing to a binary alpha. Hard edges.
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i + 3] = d[i + 3] > 128 ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
  }

  function treatQuantize(canvas, cellSize) {
    cellSize = cellSize || 9;
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(img.data);
    const d = img.data;

    // Sample one pixel per cell, paint whole cell with that color.
    for (let cy = 0; cy < h; cy += cellSize) {
      for (let cx = 0; cx < w; cx += cellSize) {
        // Average the cell's opaque pixels
        let sumR = 0, sumG = 0, sumB = 0, sumA = 0, n = 0;
        for (let y = cy; y < Math.min(h, cy + cellSize); y++) {
          for (let x = cx; x < Math.min(w, cx + cellSize); x++) {
            const i = (y * w + x) * 4;
            if (src[i + 3] < 20) continue;
            sumR += src[i]; sumG += src[i + 1]; sumB += src[i + 2];
            sumA += src[i + 3]; n++;
          }
        }
        if (n === 0) continue;
        const r = sumR / n, g = sumG / n, b = sumB / n, a = sumA / n;
        for (let y = cy; y < Math.min(h, cy + cellSize); y++) {
          for (let x = cx; x < Math.min(w, cx + cellSize); x++) {
            const i = (y * w + x) * 4;
            d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function treatGrain(canvas, rng) {
    // Subtle film-grain-style noise in the color channels. Good for woodblock,
    // linocut, anything with natural material texture.
    rng = rng || Math.random;
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 20) continue;
        const n = (smoothNoise(x * 1.7, y * 1.7) + smoothNoise(x * 5.3, y * 5.3)) * 18;
        d[i]     = Math.min(255, Math.max(0, d[i]     + n));
        d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n * 0.85));
        d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n * 0.70));
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function treatSepia(canvas, rng) {
    // Soft pencil-drawing feel: mild edge displacement + alpha variance.
    // Less aggressive than pigment, suited to studio-ink aesthetics.
    rng = rng || Math.random;
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, w, h);
    const src = new Uint8ClampedArray(img.data);
    const d = img.data;
    const DISP = 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dx = smoothNoise(x, y) * DISP;
        const dy = smoothNoise(x + 300, y + 200) * DISP;
        const sx = Math.min(w - 1, Math.max(0, Math.round(x + dx)));
        const sy = Math.min(h - 1, Math.max(0, Math.round(y + dy)));
        const si = (sy * w + sx) * 4;
        d[i]     = src[si];
        d[i + 1] = src[si + 1];
        d[i + 2] = src[si + 2];
        d[i + 3] = src[si + 3];
      }
    }
    // Alpha variance for uneven pen pressure
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 20) continue;
      const n = smoothNoise(i * 0.011, i * 0.007) * 0.25 + 0.9;
      d[i + 3] = Math.min(255, Math.max(0, d[i + 3] * n));
    }
    ctx.putImageData(img, 0, 0);
  }

  function treatBlueprint(canvas) {
    // Two-tone cyanotype: any drawn pixel becomes bright cyan, transparent
    // otherwise. Used as the sole color pass for the blueprint era - the
    // canvas below supplies the dark cyan background.
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 80) {
        d[i]     = 200;
        d[i + 1] = 228;
        d[i + 2] = 255;
        d[i + 3] = 255;
      } else {
        d[i + 3] = 0;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function treatGoldHighlight(canvas) {
    // Tint high-luminance (structural/white) pixels with a gold leaf sheen.
    // Leaves blue/red pigment pixels untouched. Use for medieval illumination.
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 20) continue;
      const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (lum > 150) {
        d[i]     = Math.min(255, lum * 1.05);
        d[i + 1] = Math.min(255, lum * 0.82);
        d[i + 2] = Math.min(255, lum * 0.35);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function treatThreshold(canvas) {
    // Hard threshold to pure primary colors. Bauhaus: no grays, just blocks.
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 100) {
        d[i + 3] = 0;
        continue;
      }
      d[i + 3] = 255;
      // Saturate: push each channel toward 0 or 255
      d[i]     = d[i]     > 128 ? 255 : 0;
      d[i + 1] = d[i + 1] > 128 ? 255 : 0;
      d[i + 2] = d[i + 2] > 128 ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
  }

  function edgeTreatment(canvas, preset, rng) {
    switch (preset) {
      case "pigment":       return treatPigment(canvas, rng);
      case "flat":          return treatFlat(canvas);
      case "quantize":      return treatQuantize(canvas, 9);
      case "grain":         return treatGrain(canvas, rng);
      case "sepia":         return treatSepia(canvas, rng);
      case "blueprint":     return treatBlueprint(canvas);
      case "goldHighlight": return treatGoldHighlight(canvas);
      case "threshold":     return treatThreshold(canvas);
      case null:
      case undefined:
      case "none":
        return;
      default:
        // Unknown preset - no-op
        return;
    }
  }

  global.PictographStylize = { recolor, edgeTreatment, pixelate };
})(typeof window !== "undefined" ? window : globalThis);
