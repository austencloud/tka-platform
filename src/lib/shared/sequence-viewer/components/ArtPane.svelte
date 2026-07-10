<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import MandalaPane from "./MandalaPane.svelte";
  import TunnelArtView from "../tunnel/TunnelArtView.svelte";
  import ArtSettingsPanel from "./ArtSettingsPanel.svelte";
  import ExportTakeover from "$lib/shared/video-export/components/ExportTakeover.svelte";
  import { toExportTakeoverPhase } from "$lib/shared/video-export/services/export-takeover-phase";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import VideoPreviewPanel from "./VideoPreviewPanel.svelte";
  import { sequenceModalExporter } from "../services/sequence-modal-exporter.svelte";
  import { exportVideoFilename } from "../services/export-video-filename";
  import { shareOrDownloadBlob } from "$lib/shared/foundation/services/file-downloader";
  import { TunnelViewController } from "../tunnel/tunnel-view-controller.svelte";
  import { MandalaViewerController } from "../state/mandala-viewer-controller.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "../domain/viewer-prop-groups";
  import type {
    PlaybackMode,
    StepPlaybackStepSize,
  } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { captureTunnelSnapshot, type SnapshotDeps } from "../tunnel/tunnel-snapshot";
  import { capturePosterFromContainer } from "../tunnel/tunnel-poster";
  import { tunnelCollectionState } from "$lib/features/tunnel-collection/state/tunnel-collection-state.svelte";
  import { TUNNEL_AUTO_EXPORT_INTENT_KEY } from "$lib/features/tunnel-collection/services/open-tunnel-in-viewer";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  // Mandala is the static tip-path bloom; Tunnel is the live kaleidoscope. The
  // viewer's mode rail picks one — this pane renders the chosen view, fixed.
  type ArtType = "mandala" | "tunnel";

  const {
    sequence,
    playback,
    artType,
    layout = "sidebar",
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
    /** "bottom" (mobile) swaps the right sidebar for a ControlDock floating over
     *  the art; "sidebar" (default, desktop) keeps the right rail. */
    layout?: "sidebar" | "bottom";
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
  // (TunnelArtView) and the controls (ArtSettingsPanel), so the panel's look /
  // grid / spectrum controls drive the same instance the canvas reads — and the
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

  // Effects config (grabbed at init — getContext must run during setup) + a ref
  // to the art body so "Save tunnel" can snapshot the live config and grab a
  // poster off the rendered canvas.
  const effectsForSave = getEffectsConfigContext();
  let artBodyEl = $state<HTMLDivElement | null>(null);

  // Playback display state read from the live panel state, so the rail's
  // Playback pane mirrors the 2D transport.
  const stepSize = $derived<StepPlaybackStepSize>(
    playback.animationState.stepPlaybackStepSize ?? 1,
  );

  function handleExport() {
    onArtExport?.({ artType, controller, mandalaController });
  }

  // Auto-export intent (collection page "Export video" button): consume the
  // session flag once, then fire the normal export path as soon as the live
  // playback controller + hydrated sequence exist. Poll (250ms, 15s cap) —
  // readiness spans the orchestrator's async service load, which has no single
  // reactive signal reachable from here.
  onMount(() => {
    if (artType !== "tunnel" || !onArtExport) return;
    let intent = false;
    try {
      intent = sessionStorage.getItem(TUNNEL_AUTO_EXPORT_INTENT_KEY) === "1";
      if (intent) sessionStorage.removeItem(TUNNEL_AUTO_EXPORT_INTENT_KEY);
    } catch {
      /* storage unavailable — no auto-export */
    }
    if (!intent) return;
    const started = performance.now();
    const timer = setInterval(() => {
      const ready =
        !playback.animationLoading &&
        !!playback.animationState.sequenceData &&
        !!playback.getPlaybackController?.();
      if (ready) {
        clearInterval(timer);
        // One settle frame so the engine finishes its first render before the
        // offscreen exporter clones its state.
        setTimeout(() => handleExport(), 400);
      } else if (performance.now() - started > 15_000) {
        clearInterval(timer); // give up silently; the manual Export still works
      }
    }, 250);
    return () => clearInterval(timer);
  });

  // Tunnel export drives the shared sequenceModalExporter (mandala uses its own
  // worker), so its progress + inline preview surface over the canvas here — the
  // Art pane has no Download-panel chrome of its own. Cancel maps to the
  // exporter's cancel.
  const exportState = $derived(sequenceModalExporter.state);
  const effectiveSeq = $derived(playback.animationState.sequenceData ?? sequence);

  // Map the shared exporter state onto ExportTakeover's phase via the shared
  // mapper — same premium blue→red ring as the mandala + animation exports.
  // tunnel-only (mandala has its own takeover).
  const takeover = $derived(
    toExportTakeoverPhase(exportState.progress, exportState.isExporting, {
      active: artType === "tunnel",
      error: exportState.error,
    }),
  );
  // Stamp the look so variant exports of one sequence don't collide.
  const tunnelSuffix = $derived(`-tunnel-${controller.activeLook.id}`);

  // Preview-first save: share sheet on mobile, download on desktop (the platform
  // gate lives in shareOrDownloadBlob). The blob is recovered from the preview's
  // object URL so the user picks where it lands instead of a blind auto-download.
  async function saveTunnelVideo() {
    const url = exportState.previewBlobUrl;
    if (!url) return;
    const blob = await (await fetch(url)).blob();
    await shareOrDownloadBlob(blob, exportVideoFilename(effectiveSeq, tunnelSuffix), {
      title: "TKA Tunnel",
    });
  }

  // Capture the live tunnel (config + effects + poster) into the collection. The
  // whole flow lives here — ArtPane owns the controller and the effects context,
  // so both the settings-panel button and the canvas right-click route through
  // this one handler.
  async function handleSaveTunnel() {
    const seq = effectiveSeq;
    if (!seq || !effectsForSave) return;
    // Capture-only deps: real handles for everything captureTunnelSnapshot READS;
    // the apply-only members (settings.updateSettings, playback.*) are never
    // called on this path, so they are no-op stubs.
    const deps: SnapshotDeps = {
      controller,
      effects: effectsForSave,
      visibility: getAnimationVisibilityManager(),
      settings: {
        bluePropType: bluePropType ?? "staff",
        redPropType: redPropType ?? "staff",
        updateSettings: () => {},
      },
      animationSettings,
      playback: { handleBpmChange: () => {}, handlePlaybackModeChange: () => {} },
      animationPanel: { playbackMode },
      getBpm: () => bpm,
    };
    const snapshot = captureTunnelSnapshot(deps);
    // Composite ALL stage layers (props + trails + effect overlays), not just the
    // first canvas, so the saved thumbnail matches the live look.
    const poster = capturePosterFromContainer(artBodyEl);
    const name = simplifyRepeatedWord(seq.word || "") || `Tunnel #${tunnelCollectionState.count + 1}`;
    try {
      await tunnelCollectionState.add({
        name,
        steps: [...seq.steps],
        snapshot,
        poster,
        source: "viewer",
      });
      toast.success("Tunnel saved to your collection");
    } catch (error) {
      // add() unshifts locally before the Firestore write, so the entry shows in
      // this session either way — be honest that it didn't sync.
      console.warn("[ArtPane] Tunnel save failed to sync:", error);
      toast.error("Couldn't sync the tunnel to your account");
    }
  }
</script>

<div class="art-pane" class:dock-mode={layout === "bottom"}>
  <div class="art-body" bind:this={artBodyEl}>
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
      <TunnelArtView {sequence} {playback} {controller} {bpm} {bluePropType} {redPropType} onSaveTunnel={handleSaveTunnel} />
    {/if}

    {#if artType === "tunnel" && exportState.previewBlobUrl && !exportState.isExporting}
      <!-- Preview-first: the rendered kaleidoscope plays inline; the user saves
           (download on desktop / share sheet on mobile) or dismisses. Nothing
           hit disk automatically. -->
      <div class="preview-overlay" transition:fade={{ duration: 180 }}>
        <VideoPreviewPanel
          blobUrl={exportState.previewBlobUrl}
          saveLabel="Save"
          onRedownload={() => void saveTunnelVideo()}
          onDismiss={() => sequenceModalExporter.dismissPreview()}
        />
      </div>
    {:else if takeover.phase !== "idle"}
      <!-- The shared premium ring overlay (same as the mandala export). The live
           kaleidoscope keeps playing, dimmed + blurred, behind the ring. -->
      <ExportTakeover
        phase={takeover.phase}
        progress={exportState.progress?.progress ?? 0}
        phaseLabel={takeover.labelKey ? t(takeover.labelKey) : ""}
        error={exportState.error}
        onCancel={() => {
          sequenceModalExporter.cancel();
          sequenceModalExporter.clearError();
        }}
        onRetry={() => {
          sequenceModalExporter.clearError();
          handleExport();
        }}
      />
    {/if}
  </div>

  <ArtSettingsPanel
    {sequence}
    {playback}
    {controller}
    {mandalaController}
    {artType}
    {layout}
    onExport={handleExport}
    onSaveTunnel={handleSaveTunnel}
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
    exporting={artType === "tunnel" && exportState.isExporting}
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
  /* Dock mode (mobile): the settings become a flow ControlDock at the bottom
     (overlay dropped), and the art shrinks above it — the same lift the card
     export uses — instead of the dock floating over and covering the art.
     Full-bleed art, no sidebar gap/padding. */
  .art-pane.dock-mode {
    flex-direction: column;
    gap: 0;
    padding: 0;
  }
  .art-body {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }
  /* In the column, flex drives the height; the fixed 100% would ignore the dock
     below and let the canvas cover it. */
  .art-pane.dock-mode .art-body {
    height: auto;
    min-height: 0;
  }

  /* Inline export preview floated over the canvas. Dim + blur the kaleidoscope
     behind it so the result reads as the focus. */
  .preview-overlay {
    position: absolute;
    inset: 0;
    z-index: 11;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(8px, 3cqw, 20px);
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(4px);
    border-radius: inherit;
    overflow: auto;
  }

  /* Adapt the shared VideoPreviewPanel (authored as a sidebar-bottom panel) into
     a floating card here — round all corners, drop the top-divider seam, cap the
     width, and lift it off the dimmed backdrop. */
  .preview-overlay :global(.preview-panel) {
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 16px;
    max-width: min(440px, 100%);
    width: 100%;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5);
  }

  /* On narrow viewports the rail stacks under the canvas so the art still has
     room to breathe rather than being crushed beside a 240px sidebar. */
  /* Legacy narrow-sidebar stack — only when NOT in dock mode. In dock mode the
     controls become a ControlDock floating over a full-bleed art body, so the
     art keeps the whole pane. */
  @container (max-width: 620px) {
    .art-pane:not(.dock-mode) {
      flex-direction: column;
    }
    .art-pane:not(.dock-mode) .art-body {
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
