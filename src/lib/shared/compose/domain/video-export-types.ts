import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";

export type VideoExportFormat = "webm" | "mp4";

export interface VideoExportProgress {
  progress: number;
  stage: "capturing" | "encoding" | "complete" | "error";
  currentFrame?: number;
  totalFrames?: number;
  error?: string;
}

export type VideoResolution = 720 | 1080 | 2160 | 4320;

export interface VideoEffectOverrides {
  fire?: boolean;
  led?: boolean;
  trails?: boolean;
  charcoal?: boolean;
}

export interface VideoExportOrchestratorOptions {
  filename?: string;
  fps?: number;
  resolution?: VideoResolution;
  loopCount?: number;
  format?: VideoExportFormat;
  /**
   * Video codec for MP4 exports. "h264" (default) = 4:2:0, max compatibility.
   * "av1" = AV1 High profile 4:4:4 — eliminates chroma-subsampling fringe for
   * near-exact parity with the on-screen render (slower encode).
   */
  codec?: "h264" | "av1";
  effectOverrides?: VideoEffectOverrides;
  compositeMode?: "none" | "horizontal" | "vertical";
  gridStepSize?: number;
  showStepNumbers?: boolean;
  includeStartPosition?: boolean;
  includeAnimationStartPosition?: boolean;
  includeEndHold?: boolean;
  /** Prop type strings (e.g. "staff"). Drive the prop BODY textures the offscreen
   *  export engine loads — without them the export falls back to global settings
   *  (default "staff") and on the QR landing page (no DI bootstrap) renders the
   *  wrong/blank prop. */
  bluePropType?: string | null;
  redPropType?: string | null;
  /** Preview dark-mode override matching the live view's prop colors. */
  previewDarkMode?: boolean | null;
  /** Whether non-radial grid points are shown (matches the live grid). */
  showNonRadialPoints?: boolean;
  /**
   * Optional per-frame overlay drawn on top of the composited animation frame
   * (after the black flatten + canvas layers + path lines), in the output-square
   * coordinate space. `sizePx` is the square animation area side in output px.
   * Used to bake a static overlay (e.g. the Mandala Rosetta's glowing mandala)
   * into the clip. Omitted by the normal viewer export.
   */
  frameOverlayDraw?: (ctx: CanvasRenderingContext2D, sizePx: number) => void;
  /**
   * Pre-roll whole loop periods (rendered, NOT encoded) before capture so a FADE
   * trail begins in steady state instead of ramping up from empty — making the
   * single MP4 loop seamlessly with no trail pop at the seam. Only meaningful for
   * a seamlessly-loopable, non-composite, pure-motion export (no start/end hold).
   */
  seamlessTrailLoop?: boolean;
  /**
   * Mux fragmented MP4 (moof fragments) instead of progressive (moov+mdat).
   * Fragmented MP4 is appendable to a MediaSource SourceBuffer for gap-free MSE
   * looping. Default false (progressive — max compatibility for downloads).
   */
  fragmented?: boolean;
  /**
   * Tunnel/art export: per-beat overlaid prop layers injected into the offscreen
   * engine so the kaleidoscope's extra copies render (and trail) like the base pair.
   * Omit for normal sequence export.
   */
  additionalLayersForBeat?: (beat: number) => AdditionalLayerProps[];

  /**
   * Square source-size override (px). When set, the export ignores the live
   * `canvas` arg for sizing and renders a square source of width=height=size
   * with NO word-header / progress-bar reserved space — and SKIPS the
   * zero-dimension guard on `canvas`. Used by tunnel/art export, where the live
   * 2D AnimatorCanvas is not mounted (Art mode's left pane is the mandala/tunnel,
   * not the animator), so `canvas` is a throwaway placeholder. Omit for normal
   * sequence export (the live canvas drives the source size as before).
   */
  sourceSizeOverride?: number;

  /**
   * Per-export overrides for chrome visibility, merged OVER the global
   * visibility manager (does NOT mutate global state). Used by tunnel export to
   * suppress hand-path lines / grid / glyph / word header / step numbers /
   * progress bar — the kaleidoscope is pure visual.
   */
  overlayOverrides?: Partial<{
    tkaGlyph: boolean;
    stepNumbers: boolean;
    wordHeader: boolean;
    progressBar: boolean;
    bluePathLines: boolean;
    redPathLines: boolean;
    grid: boolean;
  }>;
  onCleanup?: () => void;
}

/**
 * Interface for the VideoExportOrchestrator, exposed in shared/ so that
 * shared-layer consumers can reference the orchestrator without importing
 * the concrete class from features/.
 */
export interface IVideoExportOrchestrator {
  executeExport(
    canvas: HTMLCanvasElement,
    playbackController: AnimationPlaybackController,
    panelState: AnimationPanelState,
    onProgress: (progress: VideoExportProgress) => void,
    options?: VideoExportOrchestratorOptions
  ): Promise<Blob>;
  cancelExport(): void;
  isExporting(): boolean;
}
