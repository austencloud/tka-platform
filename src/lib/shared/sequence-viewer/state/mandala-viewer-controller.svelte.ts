import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { MandalaPathShape, MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";
import type {
  MandalaColorMode,
  MandalaPresetId,
} from "../components/MandalaViewerControls.svelte";
import { getMandalaGeometryCalculator } from "$lib/shared/mandala/getMandalaGeometryCalculator";
import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";
import type { MandalaPathOptions } from "$lib/shared/mandala/services/types";

export interface MandalaControllerSources {
  getSequence: () => SequenceData;
  getBluePropType: () => string | undefined;
  getRedPropType: () => string | undefined;
}

const BASE_PERIOD = 5;
const COLOR_CYCLE_BREATHS = 3;
const BG_COLOR = "#000000";

const PRESET_COLORS: Record<
  Exclude<MandalaPresetId, "custom">,
  { pair: [string, string]; morph: string[] }
> = {
  aurora: { pair: ["#00e5ff", "#76ff03"], morph: ["#00e5ff", "#76ff03", "#7c4dff", "#ff4081", "#00e5ff"] },
  neon: { pair: ["#ff0099", "#00ddff"], morph: ["#ff0099", "#7928ca", "#0055ff", "#00ddff", "#ff0099"] },
  ember: { pair: ["#ff3d00", "#ffd600"], morph: ["#ff3d00", "#ff9100", "#ffd600", "#ff6d00", "#ff3d00"] },
  twilight: { pair: ["#aa00ff", "#f50057"], morph: ["#311b92", "#aa00ff", "#f50057", "#ff6d00", "#311b92"] },
  ice: { pair: ["#4dd0e1", "#b388ff"], morph: ["#e0f7fa", "#4dd0e1", "#1a237e", "#b388ff", "#e0f7fa"] },
  solar: { pair: ["#ffab00", "#dd2c00"], morph: ["#ffab00", "#ff6d00", "#dd2c00", "#ffea00", "#ffab00"] },
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function mixColors(a: string, b: string): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(Math.round((ar + br) / 2), Math.round((ag + bg) / 2), Math.round((ab + bb) / 2));
}

function withAlpha(hex: string, alpha: number): string {
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

function svgToCanvas(
  svgStr: string,
  canvas: HTMLCanvasElement,
  rotDeg: number,
  bg: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const ctx = canvas.getContext("2d")!;
      const s = canvas.width;
      ctx.clearRect(0, 0, s, s);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, s, s);
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.translate(-s / 2, -s / 2);
      ctx.drawImage(img, 0, 0, s, s);
      ctx.restore();
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG render failed"));
    };
    img.src = url;
  });
}

/**
 * Shared animation + palette + export state for the mandala viewer.
 * Owns every tunable the controls expose so desktop (rail) and mobile
 * (bottom sheet) presentations render from one source of truth.
 */
export class MandalaViewerController {
  paused = $state(false);
  pathShape = $state<MandalaPathShape>("arc");
  rotation = $state(90);
  speed = $state(1);
  depth = $state(100);
  colorMode = $state<MandalaColorMode>("flow");
  preset = $state<MandalaPresetId>("aurora");
  customBlue = $state("#4fc3f7");
  customRed = $state("#ef5350");
  lineWeight = $state(2.5);
  exporting = $state(false);

  readonly bgColor = BG_COLOR;

  #sources: MandalaControllerSources;
  #colorPhase = $state(0);
  #colorRafId = 0;

  period = $derived(BASE_PERIOD / this.speed);
  rangeMax = $derived(this.depth * 2.5);

  constructor(sources: MandalaControllerSources) {
    this.#sources = sources;

    // Color-morph animation loop (flow mode only, paused respected).
    $effect(() => {
      if (this.paused || this.colorMode !== "flow") {
        if (this.#colorRafId) {
          cancelAnimationFrame(this.#colorRafId);
          this.#colorRafId = 0;
        }
        return;
      }
      const cyclePeriod = this.period * COLOR_CYCLE_BREATHS;
      let startTime: number | null = null;
      const tick = (time: number) => {
        if (startTime === null) startTime = time;
        const elapsed = (time - startTime) / 1000;
        this.#colorPhase = (elapsed % cyclePeriod) / cyclePeriod;
        this.#colorRafId = requestAnimationFrame(tick);
      };
      this.#colorRafId = requestAnimationFrame(tick);
      return () => {
        if (this.#colorRafId) {
          cancelAnimationFrame(this.#colorRafId);
          this.#colorRafId = 0;
        }
      };
    });
  }

  #getPresetPair(): [string, string] {
    if (this.preset === "custom") return [this.customBlue, this.customRed];
    return PRESET_COLORS[this.preset].pair;
  }

  #getPresetMorph(): string[] {
    if (this.preset === "custom") {
      const mix = mixColors(this.customBlue, this.customRed);
      return [this.customBlue, mix, this.customRed, mix, this.customBlue];
    }
    return PRESET_COLORS[this.preset].morph;
  }

  palette = $derived.by((): MandalaPalette => {
    if (this.colorMode === "solid") {
      const [c1, c2] = this.#getPresetPair();
      const mix = mixColors(c1, c2);
      return {
        blueStroke: c1, blueFill: withAlpha(c1, 0.15),
        redStroke: c2, redFill: withAlpha(c2, 0.15),
        purpleStroke: mix, purpleFill: withAlpha(mix, 0.2),
      };
    }
    const morphColors = this.#getPresetMorph();
    const c1 = sampleGradient(morphColors, this.#colorPhase);
    const c2 = sampleGradient(morphColors, (this.#colorPhase + 0.4) % 1);
    const mix = mixColors(c1, c2);
    return {
      blueStroke: c1, blueFill: withAlpha(c1, 0.15),
      redStroke: c2, redFill: withAlpha(c2, 0.15),
      purpleStroke: mix, purpleFill: withAlpha(mix, 0.2),
    };
  });

  /** The active preset's two representative colors (for compact swatches). */
  accentPair = $derived.by((): [string, string] => this.#getPresetPair());

  /**
   * CSS gradient that previews what a preset actually renders as — the flow
   * morph for named presets, a blue→red sweep for custom. Side-by-side dots
   * misrepresent the output; this shows the real palette.
   */
  previewGradient(id: MandalaPresetId): string {
    if (id === "custom") {
      const mix = mixColors(this.customBlue, this.customRed);
      return `linear-gradient(120deg, ${this.customBlue}, ${mix}, ${this.customRed})`;
    }
    return `linear-gradient(120deg, ${PRESET_COLORS[id].morph.join(", ")})`;
  }

  gradientColors = $derived.by(() => {
    if (this.colorMode !== "flow") return undefined;
    const morphColors = this.#getPresetMorph();
    const c1 = sampleGradient(morphColors, this.#colorPhase);
    const c2 = sampleGradient(morphColors, (this.#colorPhase + 0.4) % 1);
    const c3 = sampleGradient(morphColors, (this.#colorPhase + 0.7) % 1);
    const mix = mixColors(c1, c2);
    return {
      blue: [c1, c3] as [string, string],
      red: [c2, c1] as [string, string],
      purple: [mix, c3] as [string, string],
    };
  });

  async handleDownload(): Promise<void> {
    const sequence = this.#sources.getSequence();
    if (this.exporting || !sequence?.steps) return;
    this.exporting = true;

    try {
      const calculator = getMandalaGeometryCalculator();
      const exportSize = 1080;
      const fps = 30;
      const cyclePeriod = this.period;
      const totalFrames = Math.ceil(fps * cyclePeriod);
      const bluePropType = this.#sources.getBluePropType();
      const redPropType = this.#sources.getRedPropType();

      const pathOpts: MandalaPathOptions | undefined =
        this.pathShape === "hybrid" ? { motionAware: true }
        : this.pathShape !== "arc" ? { pathShape: this.pathShape }
        : undefined;

      const isFlow = this.colorMode === "flow";
      const morphColors = isFlow ? this.#getPresetMorph() : null;
      const colorCycleFrames = totalFrames * COLOR_CYCLE_BREATHS;
      const solidPair = !isFlow ? this.#getPresetPair() : null;

      const canvas = document.createElement("canvas");
      canvas.width = exportSize;
      canvas.height = exportSize;

      const h264Mod = await import("h264-mp4-encoder");
      const createEncoder = h264Mod.createH264MP4Encoder ??
        (h264Mod.default as { createH264MP4Encoder: () => Promise<unknown> })?.createH264MP4Encoder;
      if (!createEncoder) throw new Error("h264-mp4-encoder unavailable");

      const encoder = (await createEncoder()) as {
        width: number; height: number; frameRate: number;
        quantizationParameter: number;
        initialize: () => void;
        addFrameRgba: (data: Uint8Array) => void;
        finalize: () => void;
        FS: { readFile: (path: string) => Uint8Array };
        delete: () => void;
      };

      encoder.width = exportSize;
      encoder.height = exportSize;
      encoder.frameRate = fps;
      encoder.quantizationParameter = 18;
      encoder.initialize();

      const ctx = canvas.getContext("2d")!;
      const maxDx = this.rangeMax;

      for (let i = 0; i < totalFrames; i++) {
        const phase = i / totalFrames;
        const triangle = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        const eased = breatheEase(triangle);
        const tipDx = maxDx * eased;
        const rotDeg = phase * this.rotation;

        let c1: string, c2: string;
        let frameGradient:
          | { blue: [string, string]; red: [string, string]; purple: [string, string] }
          | undefined;

        if (morphColors) {
          const cPhase = (i % colorCycleFrames) / colorCycleFrames;
          c1 = sampleGradient(morphColors, cPhase);
          c2 = sampleGradient(morphColors, (cPhase + 0.4) % 1);
          const c3 = sampleGradient(morphColors, (cPhase + 0.7) % 1);
          const mix = mixColors(c1, c2);
          frameGradient = { blue: [c1, c3], red: [c2, c1], purple: [mix, c3] };
        } else {
          c1 = solidPair![0];
          c2 = solidPair![1];
        }
        const mix = mixColors(c1, c2);
        const framePalette: MandalaPalette = {
          blueStroke: c1, blueFill: withAlpha(c1, 0.15),
          redStroke: c2, redFill: withAlpha(c2, 0.15),
          purpleStroke: mix, purpleFill: withAlpha(mix, 0.2),
        };

        const paths = calculator.calculate(
          sequence.steps, bluePropType, redPropType, pathOpts, { dx: tipDx, dy: 0 },
        );

        const svgStr = renderMandalaSVG(paths, {
          size: exportSize, style: "stroke", show: "both",
          palette: framePalette, strokeWidth: this.lineWeight, tipDx,
          gradient: frameGradient,
        });
        await svgToCanvas(svgStr, canvas, rotDeg, this.bgColor);

        const imageData = ctx.getImageData(0, 0, exportSize, exportSize);
        encoder.addFrameRgba(new Uint8Array(imageData.data.buffer));
      }

      encoder.finalize();
      const data = encoder.FS.readFile("output.mp4");
      encoder.delete();

      const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mandala-${this.pathShape}-${this.preset}-${this.speed}x.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Mandala export failed:", err);
    } finally {
      this.exporting = false;
    }
  }
}
