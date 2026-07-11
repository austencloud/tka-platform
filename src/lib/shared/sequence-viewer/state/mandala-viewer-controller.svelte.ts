import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type {
  MandalaPathShape,
  MandalaPalette,
  MandalaColorMode,
  MandalaPresetId,
} from "$lib/shared/mandala/domain/mandala-types";
import {
  PRESET_COLORS,
  mixColors,
  withAlpha,
  sampleGradient,
} from "$lib/shared/mandala/domain/mandala-palette";
import type { MandalaFrameSpec } from "$lib/shared/mandala/services/mandala-frame-renderer";
import type { MandalaExportDiag } from "$lib/shared/mandala/workers/mandala-export.worker";
import {
  estimateExportTime,
  recordExportThroughput,
  hasDeviceMetrics,
} from "$lib/shared/animation-panel/state/export-timing-tracker";
import { shareOrDownloadBlob } from "$lib/shared/foundation/services/file-downloader";
import {
  exportMandalaVideo,
  mandalaBitrateFor,
  type MandalaVideoExportHandle,
} from "$lib/shared/mandala/services/mandala-video-exporter";

export type MandalaExportPhase = "idle" | "capturing" | "encoding" | "complete" | "error";
export type MandalaExportResolution = 720 | 1080 | 2160;
export type MandalaExportFps = 30 | 60;

export interface MandalaControllerSources {
  getSequence: () => SequenceData;
  getBluePropType: () => string | undefined;
  getRedPropType: () => string | undefined;
}

const BASE_PERIOD = 5;
const COLOR_CYCLE_BREATHS = 3;
const BG_COLOR = "#000000";

const EXPORT_STORAGE_KEY = "tka_mandala_export";
// The mandala's *look* (shape/spin/speed/colors/weight/depth), persisted apart
// from the export config so the viewer reopens in the look the user last set.
const VIEW_STORAGE_KEY = "tka_mandala_view_state";

interface MandalaViewState {
  pathShape: MandalaPathShape;
  rotation: number;
  speed: number;
  depth: number;
  colorMode: MandalaColorMode;
  preset: MandalaPresetId;
  customBlue: string;
  customRed: string;
  lineWeight: number;
}
function clampReps(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

function loadExportConfig(): {
  reps: number;
  resolution: MandalaExportResolution;
  fps: MandalaExportFps;
} {
  const def = { reps: 3, resolution: 1080 as MandalaExportResolution, fps: 60 as MandalaExportFps };
  if (typeof localStorage === "undefined") return def;
  try {
    const raw = localStorage.getItem(EXPORT_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<typeof def>;
      return {
        reps: clampReps(p.reps ?? def.reps),
        resolution: (p.resolution ?? def.resolution) as MandalaExportResolution,
        fps: (p.fps ?? def.fps) as MandalaExportFps,
      };
    }
  } catch {
    // fall through to defaults
  }
  return def;
}

function loadViewState(): Partial<MandalaViewState> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<MandalaViewState>) : {};
  } catch {
    return {};
  }
}

// Flow-color helpers live in the shared mandala-palette module so the viewer
// and the MandalaLoader render from one source of truth.

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

  // Export config (persisted to localStorage).
  exportReps = $state(3);
  exportResolution = $state<MandalaExportResolution>(1080);
  exportFps = $state<MandalaExportFps>(60);

  // Export lifecycle (drives the fullscreen takeover).
  exportPhase = $state<MandalaExportPhase>("idle");
  exportProgress = $state(0);
  exportError = $state<string | null>(null);
  /** Last export diagnostic (render/encode/mux split, HW status) — logged live. */
  lastExportDiag = $state<MandalaExportDiag | null>(null);

  readonly bgColor = BG_COLOR;

  #sources: MandalaControllerSources;
  #colorPhase = $state(0);
  #colorRafId = 0;
  #exportHandle: MandalaVideoExportHandle | null = null;

  period = $derived(BASE_PERIOD / this.speed);
  rangeMax = $derived(this.depth * 2.5);

  // Device-calibrated estimate (seconds) for the current config + cycle length.
  estimateSeconds = $derived(
    estimateExportTime(this.exportResolution, this.exportFps, this.period, this.exportReps) ?? 0,
  );
  // True once we have real throughput samples for this resolution (vs fallback).
  hasMetrics = $derived(hasDeviceMetrics(this.exportResolution));
  // Total frames that will be encoded for the current config.
  exportFrameCount = $derived(
    Math.max(1, Math.ceil(this.period * this.exportFps)) * this.exportReps,
  );

  constructor(sources: MandalaControllerSources) {
    this.#sources = sources;

    const cfg = loadExportConfig();
    this.exportReps = cfg.reps;
    this.exportResolution = cfg.resolution;
    this.exportFps = cfg.fps;

    // Restore the persisted look (each field guarded so a partial/old payload
    // falls back to the field default).
    const view = loadViewState();
    if (view.pathShape !== undefined) this.pathShape = view.pathShape;
    if (typeof view.rotation === "number") this.rotation = view.rotation;
    if (typeof view.speed === "number") this.speed = view.speed;
    if (typeof view.depth === "number") this.depth = view.depth;
    if (view.colorMode !== undefined) this.colorMode = view.colorMode;
    if (view.preset !== undefined) this.preset = view.preset;
    if (typeof view.customBlue === "string") this.customBlue = view.customBlue;
    if (typeof view.customRed === "string") this.customRed = view.customRed;
    if (typeof view.lineWeight === "number") this.lineWeight = view.lineWeight;

    // Persist the look on change (separate key from export config).
    $effect(() => {
      const snapshot: MandalaViewState = {
        pathShape: this.pathShape,
        rotation: this.rotation,
        speed: this.speed,
        depth: this.depth,
        colorMode: this.colorMode,
        preset: this.preset,
        customBlue: this.customBlue,
        customRed: this.customRed,
        lineWeight: this.lineWeight,
      };
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // ignore storage failures
      }
    });

    // Persist export config on change.
    $effect(() => {
      const snapshot = {
        reps: this.exportReps,
        resolution: this.exportResolution,
        fps: this.exportFps,
      };
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(EXPORT_STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // ignore storage failures
      }
    });

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

  /** Legacy entry point (real viewer's side rail / download button). */
  async handleDownload(): Promise<void> {
    this.startExport();
  }

  /**
   * Export the mandala to an MP4. The worker runs the ENTIRE pipeline off the
   * main thread — per-frame geometry, gradient/glow canvas render, rotation, and
   * the H.264 encode — so the on-screen mandala keeps undulating without jank.
   * The main thread only posts the spec once and reflects progress.
   */
  startExport(): void {
    const sequence = this.#sources.getSequence();
    if (
      this.exporting ||
      (this.exportPhase !== "idle" && this.exportPhase !== "complete" && this.exportPhase !== "error")
    )
      return;
    if (!sequence?.steps) return;

    this.exportError = null;
    this.exportProgress = 0;
    this.exportPhase = "capturing";
    this.exporting = true;

    const resolution = this.exportResolution;
    const fps = this.exportFps;
    const reps = this.exportReps;
    const bitrate = mandalaBitrateFor(resolution);
    const startMs = performance.now();
    const totalFrames = Math.max(1, Math.ceil(this.period * fps)) * reps;

    const isFlow = this.colorMode === "flow";
    // steps may be Svelte reactive proxies / domain class instances. JSON
    // round-trip yields the plain, structured-cloneable data the worker needs.
    const plainSteps = JSON.parse(JSON.stringify(sequence.steps));
    const spec: MandalaFrameSpec = {
      steps: plainSteps,
      bluePropType: this.#sources.getBluePropType(),
      redPropType: this.#sources.getRedPropType(),
      pathShape: this.pathShape,
      lineWeight: this.lineWeight,
      bgColor: this.bgColor,
      resolution,
      period: this.period,
      reps,
      fps,
      rangeMax: this.rangeMax,
      rotation: this.rotation,
      morphColors: isFlow ? this.#getPresetMorph() : null,
      solidPair: isFlow ? null : this.#getPresetPair(),
    };

    // The shared exporter owns the worker lifecycle (cache-busted construction,
    // message protocol, beforeunload guard, teardown). The controller keeps its
    // own state, diagnostics logging, throughput recording, and delivery.
    const handle = exportMandalaVideo(spec, bitrate, {
      onPhase: (phase) => {
        if (phase === "encoding") this.exportPhase = "encoding";
      },
      onProgress: (fraction) => {
        this.exportProgress = fraction;
      },
      onDiag: (d) => {
        // Surface where export wall-time goes so a slow export is diagnosable
        // live (render vs encode-wait vs mux, and whether HW encode engaged).
        const tag = `[mandala-export ${d.phase}]`;
        if (d.phase === "config") {
          console.log(`${tag} codec=${d.codec} hwSupported=${d.hwSupported} encoder=${d.encoder} res=${d.resolution} fps=${d.fps} frames=${d.totalFrames}`);
        } else {
          const mp = +((d.resolution * d.resolution) / 1_000_000).toFixed(1);
          console.log(
            `${tag} ${d.encodedFrames}/${d.totalFrames} · encode=${d.encodeFps}fps · render=${d.renderMs}ms wait=${d.encodeWaitMs}ms vframe=${d.vfMs}ms mux=${d.muxMs}ms · ${mp}MP/frame codec=${d.codec}` +
            (d.phase === "done" && d.encodeFps > 0 && d.encodeFps < 24
              ? `  ⚠ encode-bound — H.264 can't keep up at ${d.resolution}² (${mp}MP). Lower resolution encodes ~(px ratio)× faster.`
              : ""),
          );
        }
        this.lastExportDiag = d;
      },
    });
    this.#exportHandle = handle;

    handle.done
      .then((blob) => {
        if (this.#exportHandle !== handle) return; // superseded/cancelled
        recordExportThroughput(resolution, totalFrames, performance.now() - startMs);
        const filename = `mandala-${this.pathShape}-${this.preset}-${reps}x.mp4`;
        // Mobile: native share sheet (canShare files). Desktop: anchor download.
        // shareOrDownloadBlob gates on the DEVICE (detectPlatform), not on
        // navigator.share existence — desktop Chrome/Edge implement the Web
        // Share API, so feature detection alone pops the Windows share sheet.
        void shareOrDownloadBlob(blob, filename, { title: "TKA Mandala" });
        this.exportPhase = "complete";
        this.exporting = false;
        this.#exportHandle = null;
        window.setTimeout(() => {
          if (this.exportPhase === "complete") this.exportPhase = "idle";
        }, 1400);
      })
      .catch((err: unknown) => {
        if (this.#exportHandle !== handle) return; // cancelled by us; state already reset
        const message = err instanceof Error ? err.message : String(err);
        console.error("Mandala export failed:", message);
        this.exportError = message;
        this.exportPhase = "error";
        this.exporting = false;
        this.#exportHandle = null;
      });
  }

  cancelExport(): void {
    const handle = this.#exportHandle;
    this.#exportHandle = null;
    handle?.cancel();
    this.#resetExport();
  }

  #resetExport(): void {
    this.exporting = false;
    this.exportProgress = 0;
    this.exportPhase = "idle";
    this.exportError = null;
  }
}
