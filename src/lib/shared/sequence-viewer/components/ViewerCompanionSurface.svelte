<script lang="ts">
  import ArtPane from "./ArtPane.svelte";
  import ChoreoCard from "./ChoreoCard.svelte";
  import { createPaneKeepAlive } from "./pane-keep-alive.svelte";
  import type { ViewerCompanionSurfaceProps } from "./viewer-split-pane-types";
  import SequenceVideos from "./sequence-videos/SequenceVideos.svelte";
  import { getViewerTunnelStageContext } from "../context/viewer-tunnel-stage-context";

  let {
    side,
    sequence,
    playback,
    imageComposition,
    propRendering,
    layout,
    splitConfig,
    bpm,
    onBpmChange,
    onSaveToLibrary,
    onPropChange,
    onFanAppearanceChange,
    onRenderProgress,
    onUnfocusPane,
    onStepClick,
    onQrPlayClick,
    onChoreoCardContextMenu,
    cardAutoLayoutOverride,
    cardContainSizeMotion = null,
    onAutoLayoutResolved,
    onPlaybackToggle,
    playbackMode,
    onPlaybackModeChange,
    rerenderTrigger,
    isLoggedIn,
    onVideoUpload,
    onArtExport,
    onArtShare,
    artShareActive = false,
    onArtExportEvent,
    onArtSettingChange,
    onArtAction,
    tunnelComposition = null,
    tunnelSaveTarget = null,
    onTunnelSaved,
  }: ViewerCompanionSurfaceProps = $props();

  const selectedPane = $derived(
    side === "left" ? splitConfig.leftPane : splitConfig.rightPane
  );
  const tunnelStage = getViewerTunnelStageContext();
  const card = createPaneKeepAlive(() => selectedPane === "card");
  const videos = createPaneKeepAlive(() => selectedPane === "videos");
  const mandala = createPaneKeepAlive(() => selectedPane === "mandala");
  const tunnel = createPaneKeepAlive(() => selectedPane === "tunnel");

  // A focused Card has no neighboring playback surface for a seek to explain.
  // Keep its cells static; split view retains click-to-seek beside the motion.
  const cardStepClick = $derived(
    layout.focusedPane === "image" ? undefined : onStepClick
  );

  function handleCloseClick(event: MouseEvent | KeyboardEvent): void {
    event.stopPropagation();
    onUnfocusPane();
  }
</script>

{#if card.mounted}
  <div
    class="media-pane preview-pane content-overlay"
    class:content-overlay-hidden={!card.shown}
  >
    {#if side === "right" && card.active && layout.focusedPane === "image" && !layout.isMobile && !layout.suppressCloseButton}
      <div
        class="pane-close-btn"
        role="button"
        tabindex="0"
        onclick={handleCloseClick}
        onkeydown={(event) => {
          if (event.key === "Enter" || event.key === " ")
            handleCloseClick(event);
        }}
        aria-label="Exit focus mode"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </div>
    {/if}

    <ChoreoCard
      {sequence}
      highlightedStepIndex={side === "right" && layout.focusedPane === "image"
        ? null
        : playback.highlightedStepIndex}
      showHighlight={side === "right" && layout.focusedPane === "image"
        ? false
        : playback.isPlaying || playback.highlightedStepIndex !== null}
      onStepClick={cardStepClick}
      {onQrPlayClick}
      clickableStart={!!cardStepClick}
      {onRenderProgress}
      showWord={imageComposition.showWord}
      showStepNumbers={imageComposition.showStepNumbers}
      showDifficultyLevel={imageComposition.showDifficulty}
      includeStartPosition={imageComposition.showStartPos}
      showNotes={imageComposition.showNotes}
      customNotesText={imageComposition.customNotesText}
      showQRCode={imageComposition.showQRCode}
      showMandala={imageComposition.showMandala ?? false}
      showLoopGlyph={imageComposition.showLoopGlyph ?? true}
      handPathMode={imageComposition.handPathMode}
      darkMode={imageComposition.darkMode}
      columnCount={imageComposition.columnCount}
      forceContain={imageComposition.forceContain}
      fitWidth={side === "right" &&
        layout.isMobile &&
        layout.focusedPane === "image"}
      leftPropType={propRendering.leftPropType}
      rightPropType={propRendering.rightPropType}
      catDogModeEnabled={propRendering.catDogModeEnabled}
      {rerenderTrigger}
      onContextMenu={onChoreoCardContextMenu}
      autoLayoutOverride={cardAutoLayoutOverride}
      containSizeMotion={cardContainSizeMotion}
      onAutoLayoutResolved={card.shown ? onAutoLayoutResolved : undefined}
    />
  </div>
{/if}

{#if videos.mounted}
  <div
    class="media-pane content-overlay"
    class:content-overlay-hidden={!videos.shown}
  >
    <!-- Browse only. Uploading and timing happen on the full Videos surface,
         which onVideoUpload switches the viewer to. -->
    <SequenceVideos
      {sequence}
      isOwned={false}
      {isLoggedIn}
      {onSaveToLibrary}
      canUpload={!!onVideoUpload}
      onUploadOpenChange={(open) => {
        if (open) onVideoUpload?.();
      }}
    />
  </div>
{/if}

{#if mandala.mounted}
  <div
    class="media-pane content-overlay"
    class:content-overlay-hidden={!mandala.shown}
  >
    <ArtPane
      artType="mandala"
      controller={tunnelStage.controller}
      active={side === "right" ? mandala.shown : true}
      shown={mandala.shown}
      {sequence}
      {playback}
      leftPropType={propRendering.leftPropType != null
        ? String(propRendering.leftPropType)
        : undefined}
      rightPropType={propRendering.rightPropType != null
        ? String(propRendering.rightPropType)
        : undefined}
      {bpm}
      {onBpmChange}
      {playbackMode}
      {onPlaybackModeChange}
      onPlaybackToggle={onPlaybackToggle ?? (() => {})}
      layout={layout.isMobile ? "bottom" : "sidebar"}
      {onPropChange}
      fanAppearance={propRendering.fanAppearance}
      {onFanAppearanceChange}
      {onArtExport}
      {onArtShare}
      {artShareActive}
      {onArtExportEvent}
      {onArtSettingChange}
      {onArtAction}
      {tunnelSaveTarget}
      {onTunnelSaved}
    />
  </div>
{/if}

{#if tunnel.mounted}
  <!-- Tunnel contributes controls and export overlays here. Its live art stays
       on the shell-owned Animator canvas beneath this transparent surface. -->
  <div
    class="media-pane content-overlay"
    class:content-overlay-hidden={!tunnel.shown}
    data-companion-surface="tunnel"
    data-shared-tunnel-canvas
    data-presented={tunnel.shown}
    inert={!tunnel.shown}
    aria-hidden={!tunnel.shown}
  >
    <ArtPane
      artType="tunnel"
      controller={tunnelStage.controller}
      sharedTunnelCanvas
      active={side === "right" ? tunnel.shown : true}
      shown={tunnel.shown}
      {sequence}
      {playback}
      leftPropType={propRendering.leftPropType != null
        ? String(propRendering.leftPropType)
        : undefined}
      rightPropType={propRendering.rightPropType != null
        ? String(propRendering.rightPropType)
        : undefined}
      {bpm}
      {onBpmChange}
      {playbackMode}
      {onPlaybackModeChange}
      onPlaybackToggle={onPlaybackToggle ?? (() => {})}
      layout={layout.isMobile ? "bottom" : "sidebar"}
      {onPropChange}
      fanAppearance={propRendering.fanAppearance}
      {onFanAppearanceChange}
      {onArtExport}
      {onArtShare}
      {artShareActive}
      {onArtExportEvent}
      {onArtSettingChange}
      {onArtAction}
      {tunnelComposition}
      {tunnelSaveTarget}
      {onTunnelSaved}
    />
  </div>
{/if}
