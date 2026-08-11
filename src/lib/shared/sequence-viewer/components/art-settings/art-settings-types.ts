import type {
  PlaybackMode,
  StepPlaybackStepSize,
} from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { ViewerPlaybackState } from "../../domain/viewer-prop-groups";
import type { MandalaViewerController } from "../../state/mandala-viewer-controller.svelte";
import type { TunnelViewController } from "../../tunnel/tunnel-view-controller.svelte";

export type ArtType = "mandala" | "tunnel";
export type ArtSettingValue = string | number | boolean | null;
export type ArtSettingChangeHandler = (
  group: string,
  setting: string,
  previousValue: ArtSettingValue,
  value: ArtSettingValue,
  coalesce?: boolean,
  source?: string
) => void;

export interface ArtSettingsPanelProps {
  sequence: SequenceData;
  playback: ViewerPlaybackState;
  controller: TunnelViewController;
  mandalaController: MandalaViewerController;
  artType: ArtType;
  layout?: "sidebar" | "bottom";
  onExport: () => void;
  /** Opens the post-share sheet with this art as the artifact. */
  onShare: () => void;
  onSaveTunnel?: () => void;
  bpm?: number;
  playbackMode?: PlaybackMode;
  stepSize?: StepPlaybackStepSize;
  isPlaying?: boolean;
  onBpmChange?: (bpm: number) => void;
  onPlaybackModeChange?: (mode: PlaybackMode) => void;
  onStepSizeChange?: (size: StepPlaybackStepSize) => void;
  onPlaybackToggle?: () => void;
  bluePropType?: string | null;
  redPropType?: string | null;
  onPropChange?: (propType: PropType) => void;
  onArtSettingChange?: ArtSettingChangeHandler;
  exporting?: boolean;
}
