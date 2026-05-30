/**
 * Pure, worker-safe mandala frame logic shared by the export worker.
 *
 * Encapsulates the seamless-loop math (whole rotation turns + whole flow-color
 * cycles) and per-frame SVG synthesis so a Web Worker can render every export
 * frame without touching the DOM. No `document`/`window`/`Image` references —
 * the worker rasterizes the returned SVG string via `createImageBitmap`.
 */

import type { MandalaGeometryCalculator } from "./mandala-geometry-calculator";
import { renderMandalaSVG } from "./mandala-renderer";
import type { MandalaPathOptions } from "./types";
import type { MandalaPalette, MandalaPathShape } from "../domain/mandala-types";

// Matches SequenceMandala.ROTATION_REF_PERIOD + controller COLOR_CYCLE_BREATHS
// so exported spin/color rates equal the on-screen rates.
const ROTATION_REF_PERIOD = 5;
const COLOR_CYCLE_BREATHS = 3;

// ── Color helpers (pure) ────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function mixColors(a: string, b: string): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(Math.round((ar + br) / 2), Math.round((ag + bg) / 2), Math.round((ab + bb) / 2));
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  );
}

function sampleGradient(colors: string[], t: number): string {
  const segments = colors.length - 1;
  const scaled = t * segments;
  const idx = Math.min(Math.floor(scaled), segments - 1);
  const frac = scaled - idx;
  return lerpColor(colors[idx]!, colors[idx + 1]!, frac);
}

function breatheEase(t: number): number {
  return Math.pow(Math.sin((t * Math.PI) / 2), 1.6);
}

// ── Frame spec + derived math ───────────────────────────────────────────────

export interface MandalaFrameSpec {
  steps: readonly any[];
  bluePropType?: string;
  redPropType?: string;
  pathShape: MandalaPathShape;
  lineWeight: number;
  bgColor: string;
  resolution: number;
  /** Seconds per undulation cycle (BASE_PERIOD / speed). */
  period: number;
  /** Undulation repetitions (1–10). */
  reps: number;
  fps: number;
  /** Max tip dx (controller rangeMax = depth * 2.5). */
  rangeMax: number;
  /** Degrees of spin per ROTATION_REF_PERIOD seconds (0 = no spin). */
  rotation: number;
  /** Resolved flow-mode morph colors, or null in solid mode. */
  morphColors: string[] | null;
  /** Resolved solid pair, or null in flow mode. */
  solidPair: [string, string] | null;
}

export interface MandalaFrameMath {
  framesPerCycle: number;
  totalFrames: number;
  /** Whole rotation turns across the clip (≥1 when spin enabled). */
  turns: number;
  /** Whole flow-color cycles across the clip (0 in solid mode). */
  colorCycles: number;
}

/**
 * Derive seamless-loop counts. Undulation repeats `reps` identical cycles.
 * Rotation is forced to a whole number of turns (≥1 when spinning) so the clip
 * starts and ends at the same angle. Flow color uses whole cycles likewise.
 */
export function deriveFrameMath(spec: MandalaFrameSpec): MandalaFrameMath {
  const framesPerCycle = Math.max(1, Math.ceil(spec.period * spec.fps));
  const totalFrames = framesPerCycle * spec.reps;

  const turnsRaw = ((spec.period * spec.reps) / ROTATION_REF_PERIOD) * spec.rotation / 360;
  const turns = spec.rotation === 0 ? 0 : Math.max(1, Math.round(turnsRaw));

  const colorCycles = spec.morphColors ? Math.max(1, Math.round(spec.reps / COLOR_CYCLE_BREATHS)) : 0;

  return { framesPerCycle, totalFrames, turns, colorCycles };
}

export interface MandalaFrameOutput {
  svg: string;
  rotDeg: number;
  /**
   * Cache key for solid-color mode: frames within a cycle repeat across reps
   * (only rotation differs, applied post-raster), so the un-rotated bitmap can
   * be cached by this key. Null in flow mode (palette differs every frame).
   */
  cacheKey: number | null;
}

function pathOptionsFor(shape: MandalaPathShape): MandalaPathOptions | undefined {
  if (shape === "hybrid") return { motionAware: true };
  if (shape !== "arc") return { pathShape: shape };
  return undefined;
}

/**
 * Render frame `i`'s SVG + rotation. The rotation is returned separately so the
 * caller applies it as a canvas transform after rasterizing (enabling the solid-
 * mode bitmap cache).
 */
export function renderMandalaFrameSVG(
  calculator: MandalaGeometryCalculator,
  spec: MandalaFrameSpec,
  math: MandalaFrameMath,
  i: number,
): MandalaFrameOutput {
  const { framesPerCycle, totalFrames, turns, colorCycles } = math;

  const cyclePhase = (i % framesPerCycle) / framesPerCycle;
  const triangle = cyclePhase < 0.5 ? cyclePhase * 2 : 2 - cyclePhase * 2;
  const tipDx = spec.rangeMax * breatheEase(triangle);

  const clipT = i / totalFrames;
  const rotDeg = turns * 360 * clipT;

  let c1: string, c2: string;
  let frameGradient:
    | { blue: [string, string]; red: [string, string]; purple: [string, string] }
    | undefined;

  if (spec.morphColors) {
    const cPhase = (clipT * colorCycles) % 1;
    c1 = sampleGradient(spec.morphColors, cPhase);
    c2 = sampleGradient(spec.morphColors, (cPhase + 0.4) % 1);
    const c3 = sampleGradient(spec.morphColors, (cPhase + 0.7) % 1);
    const mix = mixColors(c1, c2);
    frameGradient = { blue: [c1, c3], red: [c2, c1], purple: [mix, c3] };
  } else {
    c1 = spec.solidPair![0];
    c2 = spec.solidPair![1];
  }

  const mix = mixColors(c1, c2);
  const palette: MandalaPalette = {
    blueStroke: c1, blueFill: withAlpha(c1, 0.15),
    redStroke: c2, redFill: withAlpha(c2, 0.15),
    purpleStroke: mix, purpleFill: withAlpha(mix, 0.2),
  };

  const paths = calculator.calculate(
    spec.steps as any,
    spec.bluePropType,
    spec.redPropType,
    pathOptionsFor(spec.pathShape),
    { dx: tipDx, dy: 0 },
  );

  const rawSvg = renderMandalaSVG(paths, {
    size: spec.resolution,
    style: "stroke",
    show: "both",
    palette,
    strokeWidth: spec.lineWeight,
    tipDx,
    gradient: frameGradient,
  });

  // renderMandalaSVG emits width/height="100%", which has no intrinsic pixel
  // size — `createImageBitmap` then fails with "source image could not be
  // decoded". Give the frame an explicit px size so it rasterizes.
  const svg = rawSvg.replace(
    'width="100%" height="100%"',
    `width="${spec.resolution}" height="${spec.resolution}"`,
  );

  // Solid mode: geometry+SVG depend only on undulation phase → cache per cycle.
  const cacheKey = spec.morphColors ? null : i % framesPerCycle;

  return { svg, rotDeg, cacheKey };
}
