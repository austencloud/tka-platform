<script lang="ts">
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import MandalaViewerControls from "./MandalaViewerControls.svelte";
  import type { MandalaColorMode, MandalaPresetId } from "./MandalaViewerControls.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { MandalaPathShape } from "$lib/shared/mandala/domain/mandala-types";
  import type { MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";
  import { getMandalaGeometryCalculator } from "$lib/shared/mandala/getMandalaGeometryCalculator";
  import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";
  import type { MandalaPathOptions } from "$lib/shared/mandala/services/contracts/types";

  interface Props {
    sequence: SequenceData;
    bluePropType?: string;
    redPropType?: string;
  }

  let { sequence, bluePropType, redPropType }: Props = $props();

  let stageEl: HTMLDivElement | undefined = $state();
  let containerSize: number = $state(400);

  // ── Standard viewer state ─────────────────────────────────────
  let paused: boolean = $state(false);
  let pathShape: MandalaPathShape = $state("arc");
  let rotation: number = $state(90);
  let speed: number = $state(1);
  let depth: number = $state(100);
  let colorMode: MandalaColorMode = $state("flow");
  let preset: MandalaPresetId = $state("aurora");
  let customBlue: string = $state("#4fc3f7");
  let customRed: string = $state("#ef5350");
  let lineWeight: number = $state(2.5);
  const bgColor = "#000000";
  let exporting: boolean = $state(false);

  // ── Derived animation params ──────────────────────────────────
  const BASE_PERIOD = 5;
  const period = $derived(BASE_PERIOD / speed);
  const rangeMax = $derived(depth * 2.5);

  // ── Color palette system (unchanged) ──────────────────────────
  const PRESET_COLORS: Record<Exclude<MandalaPresetId, "custom">, { pair: [string, string]; morph: string[] }> = {
    aurora: {
      pair: ["#00e5ff", "#76ff03"],
      morph: ["#00e5ff", "#76ff03", "#7c4dff", "#ff4081", "#00e5ff"],
    },
    neon: {
      pair: ["#ff0099", "#00ddff"],
      morph: ["#ff0099", "#7928ca", "#0055ff", "#00ddff", "#ff0099"],
    },
    ember: {
      pair: ["#ff3d00", "#ffd600"],
      morph: ["#ff3d00", "#ff9100", "#ffd600", "#ff6d00", "#ff3d00"],
    },
    twilight: {
      pair: ["#aa00ff", "#f50057"],
      morph: ["#311b92", "#aa00ff", "#f50057", "#ff6d00", "#311b92"],
    },
    ice: {
      pair: ["#4dd0e1", "#b388ff"],
      morph: ["#e0f7fa", "#4dd0e1", "#1a237e", "#b388ff", "#e0f7fa"],
    },
    solar: {
      pair: ["#ffab00", "#dd2c00"],
      morph: ["#ffab00", "#ff6d00", "#dd2c00", "#ffea00", "#ffab00"],
    },
  };

  function getPresetPair(): [string, string] {
    if (preset === "custom") return [customBlue, customRed];
    return PRESET_COLORS[preset].pair;
  }

  function getPresetMorph(): string[] {
    if (preset === "custom") {
      const mix = mixColors(customBlue, customRed);
      return [customBlue, mix, customRed, mix, customBlue];
    }
    return PRESET_COLORS[preset].morph;
  }

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
    return rgbToHex(
      Math.round((ar + br) / 2),
      Math.round((ag + bg) / 2),
      Math.round((ab + bb) / 2),
    );
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

  const COLOR_CYCLE_BREATHS = 3;
  let colorPhase: number = $state(0);
  let colorRafId: number = 0;

  $effect(() => {
    if (paused || colorMode !== "flow") {
      if (colorRafId) { cancelAnimationFrame(colorRafId); colorRafId = 0; }
      return;
    }
    const cyclePeriod = period * COLOR_CYCLE_BREATHS;
    let startTime: number | null = null;

    function tick(time: number) {
      if (startTime === null) startTime = time;
      const elapsed = (time - startTime) / 1000;
      colorPhase = (elapsed % cyclePeriod) / cyclePeriod;
      colorRafId = requestAnimationFrame(tick);
    }
    colorRafId = requestAnimationFrame(tick);
    return () => { if (colorRafId) { cancelAnimationFrame(colorRafId); colorRafId = 0; } };
  });

  const palette = $derived.by((): MandalaPalette => {
    if (colorMode === "solid") {
      const [c1, c2] = getPresetPair();
      const mix = mixColors(c1, c2);
      return {
        blueStroke: c1, blueFill: withAlpha(c1, 0.15),
        redStroke: c2, redFill: withAlpha(c2, 0.15),
        purpleStroke: mix, purpleFill: withAlpha(mix, 0.2),
      };
    }
    const morphColors = getPresetMorph();
    const c1 = sampleGradient(morphColors, colorPhase);
    const c2 = sampleGradient(morphColors, (colorPhase + 0.4) % 1);
    const mix = mixColors(c1, c2);
    return {
      blueStroke: c1, blueFill: withAlpha(c1, 0.15),
      redStroke: c2, redFill: withAlpha(c2, 0.15),
      purpleStroke: mix, purpleFill: withAlpha(mix, 0.2),
    };
  });

  const gradientColors = $derived.by(() => {
    if (colorMode !== "flow") return undefined;
    const morphColors = getPresetMorph();
    const c1 = sampleGradient(morphColors, colorPhase);
    const c2 = sampleGradient(morphColors, (colorPhase + 0.4) % 1);
    const c3 = sampleGradient(morphColors, (colorPhase + 0.7) % 1);
    const mix = mixColors(c1, c2);
    return {
      blue: [c1, c3] as [string, string],
      red: [c2, c1] as [string, string],
      purple: [mix, c3] as [string, string],
    };
  });

  $effect(() => {
    if (!stageEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      containerSize = Math.floor(Math.min(width, height));
    });
    observer.observe(stageEl);
    return () => observer.disconnect();
  });

  function breatheEase(t: number): number {
    return Math.pow(Math.sin(t * Math.PI / 2), 1.6);
  }

  function svgToCanvas(svgStr: string, canvas: HTMLCanvasElement, rotDeg: number, bg: string): Promise<void> {
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

  async function handleDownload() {
    if (exporting || !sequence?.steps) return;
    exporting = true;

    try {
      const calculator = getMandalaGeometryCalculator();
      const exportSize = 1080;
      const fps = 30;
      const cyclePeriod = period;
      const totalFrames = Math.ceil(fps * cyclePeriod);

      const pathOpts: MandalaPathOptions | undefined =
        pathShape === "hybrid" ? { motionAware: true }
        : pathShape !== "arc" ? { pathShape }
        : undefined;

      const isFlow = colorMode === "flow";
      const morphColors = isFlow ? getPresetMorph() : null;
      const colorCycleFrames = totalFrames * COLOR_CYCLE_BREATHS;
      const solidPair = !isFlow ? getPresetPair() : null;

      const canvas = document.createElement("canvas");
      canvas.width = exportSize;
      canvas.height = exportSize;

      const h264Mod = await import("h264-mp4-encoder");
      const createEncoder = h264Mod.createH264MP4Encoder ??
        (h264Mod.default as { createH264MP4Encoder: () => Promise<unknown> })?.createH264MP4Encoder;
      if (!createEncoder) throw new Error("h264-mp4-encoder unavailable");

      const encoder = await createEncoder() as {
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
      const maxDx = rangeMax;

      for (let i = 0; i < totalFrames; i++) {
        const phase = i / totalFrames;
        const triangle = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        const eased = breatheEase(triangle);
        const tipDx = maxDx * eased;
        const rotDeg = phase * rotation;

        let c1: string, c2: string;
        let frameGradient: { blue: [string, string]; red: [string, string]; purple: [string, string] } | undefined;

        if (morphColors) {
          const cPhase = (i % colorCycleFrames) / colorCycleFrames;
          c1 = sampleGradient(morphColors, cPhase);
          c2 = sampleGradient(morphColors, (cPhase + 0.4) % 1);
          const c3 = sampleGradient(morphColors, (cPhase + 0.7) % 1);
          const mix = mixColors(c1, c2);
          frameGradient = {
            blue: [c1, c3],
            red: [c2, c1],
            purple: [mix, c3],
          };
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
          sequence.steps, bluePropType, redPropType, pathOpts, { dx: tipDx, dy: 0 }
        );

        const svgStr = renderMandalaSVG(paths, {
          size: exportSize, style: "stroke", show: "both",
          palette: framePalette, strokeWidth: lineWeight, tipDx,
          gradient: frameGradient,
        });
        await svgToCanvas(svgStr, canvas, rotDeg, bgColor);

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
      a.download = `mandala-${pathShape}-${preset}-${speed}x.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Mandala export failed:", err);
    } finally {
      exporting = false;
    }
  }
</script>

<div class="mandala-pane" style:background={bgColor}>
  <div class="mandala-stage" bind:this={stageEl}>
    <SequenceMandala
      {sequence}
      animate={!paused}
      animateMin={0}
      animateMax={rangeMax}
      animatePeriod={period}
      animateEasing="breathe"
      animateRotation={rotation}
      {pathShape}
      size={containerSize}
      {bluePropType}
      {redPropType}
      mode="card-back"
      style="stroke"
      show="both"
      {palette}
      strokeWidth={lineWeight}
      gradient={gradientColors}
    />
  </div>

  <aside class="controls-rail">
    <MandalaViewerControls
      {paused}
      {pathShape}
      {rotation}
      {speed}
      {depth}
      {colorMode}
      {preset}
      {customBlue}
      {customRed}
      strokeWidth={lineWeight}
      onPausedChange={(v) => { paused = v; }}
      onPathShapeChange={(v) => { pathShape = v; }}
      onRotationChange={(v) => { rotation = v; }}
      onSpeedChange={(v) => { speed = v; }}
      onDepthChange={(v) => { depth = v; }}
      onColorModeChange={(v) => { colorMode = v; }}
      onPresetChange={(v) => { preset = v; }}
      onCustomBlueChange={(v) => { customBlue = v; }}
      onCustomRedChange={(v) => { customRed = v; }}
      onStrokeWidthChange={(v) => { lineWeight = v; }}
      onDownload={exporting ? undefined : handleDownload}
    />
  </aside>
</div>

<style>
  .mandala-pane {
    width: 100%;
    height: 100%;
    display: flex;
    overflow: hidden;
  }

  .mandala-stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    position: relative;
  }

  .controls-rail {
    flex-shrink: 0;
    width: fit-content;
    height: 100%;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    backdrop-filter: blur(12px);
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
</style>
