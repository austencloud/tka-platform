<script lang="ts">
  import MandalaPane from "./MandalaPane.svelte";
  import TunnelArtView from "../tunnel/TunnelArtView.svelte";
  import ArtSettingsPanel from "./ArtSettingsPanel.svelte";
  import { TunnelViewController } from "../tunnel/tunnel-view-controller.svelte";
  import { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "../domain/viewer-prop-groups";
  import type {
    PlaybackMode,
    StepPlaybackStepSize,
  } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

  // Mandala is the static tip-path bloom; Tunnel is the live kaleidoscope. The
  // viewer's mode rail picks one — this pane renders the chosen view, fixed.
  type ArtType = "mandala" | "tunnel";

  const {
    sequence,
    playback,
    artType,
    bluePropType,
    redPropType,
    bpm = 60,
    onBpmChange = () => {},
    playbackMode = "continuous",
    onPlaybackModeChange = () => {},
    onPlaybackToggle = () => {},
    onArtExport,
  }: {
    sequence: SequenceData;
    playback: ViewerPlaybackState;
    /** Which art view this pane renders. The mode rail switches between Mandala
     *  and Tunnel now, so the pane no longer hosts an in-panel toggle. */
    artType: ArtType;
    bluePropType?: string;
    redPropType?: string;
    bpm?: number;
    onBpmChange?: (bpm: number) => void;
    playbackMode?: PlaybackMode;
    onPlaybackModeChange?: (mode: PlaybackMode) => void;
    onPlaybackToggle?: () => void;
    /**
     * Resolved viewer export entry. When the type is "tunnel" the caller MUST
     * thread `additionalLayersForBeat` + the all-false `overlayOverrides`
     * through to the offscreen renderer (the kaleidoscope is pure visual). When
     * the type is "mandala" the caller drives the mandala's OWN export worker via
     * `mandalaController.startExport()` (a separate pipeline — never the shared
     * orchestrator). Omitted on surfaces (e.g. the QR landing page) that have no
     * live playback controller / canvas to drive a video export.
     */
    onArtExport?: (args: {
      artType: ArtType;
      controller: TunnelViewController;
      mandalaController: MandalaViewerController;
    }) => void;
  } = $props();

  // The tunnel controller is owned HERE and shared with both the rendering view
  // (TunnelArtView) and the controls (ArtSettingsPanel), so the panel's fold /
  // mirror / preset buttons drive the same instance the canvas reads — and the
  // export entry can derive per-beat layers from it.
  const controller = new TunnelViewController({
    getSequence: () => playback.animationState.sequenceData ?? sequence,
  });
  // Only build/animate the kaleidoscope layers when this pane is the tunnel —
  // a mandala pane keeps a (cheap) controller but doesn't drive the layer build.
  $effect(() => {
    controller.active = artType === "tunnel";
  });

  // The mandala controller is owned HERE (not inside MandalaPane) so the same
  // instance backs the in-pane dock/takeover AND the Art panel's Export button —
  // the orchestrator drives the mandala's own export worker via
  // mandalaController.startExport() (a pipeline separate from the shared video
  // export orchestrator).
  const mandalaController = new MandalaViewerController({
    getSequence: () => playback.animationState.sequenceData ?? sequence,
    getBluePropType: () => bluePropType,
    getRedPropType: () => redPropType,
  });

  // Playback display state read from the live panel state, so the rail's
  // Playback pane mirrors the 2D transport.
  const stepSize = $derived<StepPlaybackStepSize>(
    playback.animationState.stepPlaybackStepSize ?? 1,
  );

  function handleExport() {
    onArtExport?.({ artType, controller, mandalaController });
  }
</script>

<div class="art-pane">
  <div class="art-body">
    {#if artType === "mandala"}
      <!-- controlsPlacement="external": the mandala's controls live in the Art
           sidebar now, so suppress the bottom dock. -->
      <MandalaPane
        ctrl={mandalaController}
        controlsPlacement="external"
        {sequence}
        {bluePropType}
        {redPropType}
      />
    {:else}
      <TunnelArtView {sequence} {playback} {controller} {bpm} {bluePropType} {redPropType} />
    {/if}
  </div>

  <ArtSettingsPanel
    {sequence}
    {playback}
    {controller}
    {mandalaController}
    {artType}
    onExport={handleExport}
    {bpm}
    {playbackMode}
    {stepSize}
    isPlaying={playback.isPlaying}
    {onBpmChange}
    {onPlaybackModeChange}
    onStepSizeChange={() => {}}
    {onPlaybackToggle}
    bluePropType={bluePropType ?? null}
    redPropType={redPropType ?? null}
  />
</div>

<style>
  .art-pane {
    position: absolute;
    inset: 0;
    display: flex;
    gap: clamp(8px, 2cqw, 16px);
    overflow: hidden;
    background: #000;
    padding: clamp(8px, 2cqw, 16px);
    box-sizing: border-box;
    container-type: inline-size;
  }
  .art-body {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }

  /* On narrow viewports the rail stacks under the canvas so the art still has
     room to breathe rather than being crushed beside a 240px sidebar. */
  @container (max-width: 620px) {
    .art-pane {
      flex-direction: column;
    }
    .art-body {
      flex: 1 1 55%;
      min-height: 0;
    }
    /* Claim a real share of the column. With height:auto the panel collapsed to
       ~3px: its inner `.sidebar-main` is flex:1 and needs a DEFINED parent height
       to fill, so an auto-height panel + a flex-fill child resolves to zero and
       the canvas ate the whole pane. A flex-basis gives sidebar-main height to
       fill; the sections scroll internally past it. */
    .art-pane :global(.art-settings-panel) {
      width: 100%;
      min-width: 0;
      flex: 0 0 45%;
      min-height: 0;
    }
  }
</style>
