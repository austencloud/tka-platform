import type { TrailSettings } from "$lib/shared/animation-engine/domain/types/trail-types";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { FanAppearance } from "$lib/shared/pictograph/prop/domain/fan-appearance";
import type { ResolvedAutoLayout } from "$lib/shared/render/services/container-aware-layout";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { ArtExportEventSink } from "../domain/art-export-analytics";
import type { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";
import type { TunnelViewController } from "../tunnel/tunnel-view-controller.svelte";
import type {
  ImageCompositionProps,
  PropRenderingProps,
  ViewerLayoutState,
  ViewerPlaybackState,
} from "../domain/viewer-prop-groups";
import type {
  ViewerActionSink,
  ViewerControlSink,
} from "../domain/viewer-control-analytics";
import type { SplitConfig } from "../services/viewer-state-persistence";
import type {
  TunnelComposition,
  TunnelSaveTarget,
} from "../tunnel/tunnel-composition";
import type { TunnelSavedCallback } from "../tunnel/tunnel-snapshot";

export type ViewerPaneSide = "left" | "right";

export interface ViewerSplitPaneProps {
  sequence: SequenceData;
  playback: ViewerPlaybackState;
  imageComposition: ImageCompositionProps;
  propRendering: PropRenderingProps;
  layout: ViewerLayoutState;
  renderMode?: "2d" | "3d";
  bpm?: number;
  onBpmChange?: (bpm: number) => void;
  onSaveToLibrary?: () => void | Promise<void>;
  onPropChange?: (propType: PropType) => void;
  onFanAppearanceChange?: (appearance: FanAppearance) => void;
  onRenderProgress?: (loaded: number, total: number) => void;
  onFocusPane: (pane: "animation" | "image") => void;
  onUnfocusPane: () => void;
  onStepClick: (stepIndex: number) => void;
  onQrPlayClick?: () => void;
  onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
  onChoreoCardContextMenu?: (x: number, y: number) => void;
  cardAutoLayoutOverride?: ResolvedAutoLayout | null;
  cardContainSizeMotion?: "focus" | "return" | "restore" | null;
  onAutoLayoutResolved?: (
    layout: ResolvedAutoLayout | null,
    width: number,
    height: number
  ) => void;
  onPlaybackToggle?: () => void;
  onSystemPlaybackChange?: (
    playing: boolean,
    source: "system_3d_loading"
  ) => void;
  onProgressBarSeek?: (targetStep: number) => void;
  onProgressBarScrubStart?: () => void;
  onProgressBarScrubEnd?: () => void;
  playbackMode?: "continuous" | "step";
  onPlaybackModeChange?: (mode: "continuous" | "step") => void;
  onSceneReadyChange?: (ready: boolean) => void;
  rerenderTrigger?: number;
  isExporting?: boolean;
  splitConfig?: SplitConfig;
  isLoggedIn?: boolean;
  onVideoUpload?: () => void;
  onArtExport?: (args: {
    artType: "mandala" | "tunnel";
    controller: TunnelViewController;
    mandalaController: MandalaViewerController;
  }) => void;
  /** Hands the active art view to the shell's post-share sheet. */
  onArtShare?: (args: {
    artType: "mandala" | "tunnel";
    controller: TunnelViewController;
    mandalaController: MandalaViewerController;
  }) => void;
  /**
   * The share sheet currently owns a render of this art. The pane suppresses
   * its own result overlay while true — otherwise the tunnel's inline
   * "Save / Dismiss" preview is sitting behind the sheet when it closes,
   * offering a second delivery of a file the sheet already handled.
   */
  artShareActive?: boolean;
  onArtExportEvent?: ArtExportEventSink;
  onArtSettingChange?: (
    group: string,
    setting: string,
    previousValue: string | number | boolean | null,
    value: string | number | boolean | null,
    coalesce?: boolean,
    source?: string
  ) => void;
  onArtAction?: ViewerActionSink;
  onViewer3DSettingChange?: ViewerControlSink;
  onViewer3DAction?: ViewerActionSink;
  suppressProgress?: boolean;
  practiceActive?: boolean;
  practiceCellSize?: number;
  practiceCanvasFraction?: number;
  practiceRunning?: boolean;
  practiceCountdown?: number;
  practiceMirrorEnabled?: boolean;
  tunnelComposition?: TunnelComposition | null;
  tunnelSaveTarget?: TunnelSaveTarget | null;
  onTunnelSaved?: TunnelSavedCallback;
}

export interface ViewerMotionSurfaceProps {
  side: ViewerPaneSide;
  sequence: SequenceData;
  playback: ViewerPlaybackState;
  propRendering: PropRenderingProps;
  layout: ViewerLayoutState;
  splitConfig: SplitConfig;
  trailSettings: TrailSettings;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  onSaveToLibrary?: () => void | Promise<void>;
  onUnfocusPane: () => void;
  onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
  onPlaybackToggle?: () => void;
  onSystemPlaybackChange?: ViewerSplitPaneProps["onSystemPlaybackChange"];
  onProgressBarSeek?: (targetStep: number) => void;
  onProgressBarScrubStart?: () => void;
  onProgressBarScrubEnd?: () => void;
  playbackMode?: "continuous" | "step";
  onPlaybackModeChange?: (mode: "continuous" | "step") => void;
  onSceneReadyChange?: (ready: boolean) => void;
  onViewer3DSettingChange?: ViewerControlSink;
  onViewer3DAction?: ViewerActionSink;
  suppressProgress: boolean;
  practiceActive: boolean;
  practiceMirrorEnabled: boolean;
  practiceResizePaused: boolean;
}

export interface ViewerCompanionSurfaceProps {
  side: ViewerPaneSide;
  sequence: SequenceData;
  playback: ViewerPlaybackState;
  imageComposition: ImageCompositionProps;
  propRendering: PropRenderingProps;
  layout: ViewerLayoutState;
  splitConfig: SplitConfig;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  onSaveToLibrary?: () => void | Promise<void>;
  onPropChange?: (propType: PropType) => void;
  onFanAppearanceChange?: (appearance: FanAppearance) => void;
  onRenderProgress?: (loaded: number, total: number) => void;
  onUnfocusPane: () => void;
  onStepClick: (stepIndex: number) => void;
  onQrPlayClick?: () => void;
  onChoreoCardContextMenu?: (x: number, y: number) => void;
  cardAutoLayoutOverride?: ResolvedAutoLayout | null;
  cardContainSizeMotion?: "focus" | "return" | "restore" | null;
  onAutoLayoutResolved?: ViewerSplitPaneProps["onAutoLayoutResolved"];
  onPlaybackToggle?: () => void;
  playbackMode?: "continuous" | "step";
  onPlaybackModeChange?: (mode: "continuous" | "step") => void;
  rerenderTrigger: number;
  isLoggedIn: boolean;
  onVideoUpload?: () => void;
  onArtExport?: ViewerSplitPaneProps["onArtExport"];
  onArtShare?: ViewerSplitPaneProps["onArtShare"];
  artShareActive?: boolean;
  onArtExportEvent?: ArtExportEventSink;
  onArtSettingChange?: ViewerSplitPaneProps["onArtSettingChange"];
  onArtAction?: ViewerActionSink;
  tunnelComposition?: TunnelComposition | null;
  tunnelSaveTarget?: TunnelSaveTarget | null;
  onTunnelSaved?: TunnelSavedCallback;
}
