<script lang="ts">
  import ArtPane from "./ArtPane.svelte";
  import ChoreoCard from "./ChoreoCard.svelte";
  import { createPaneKeepAlive } from "./pane-keep-alive.svelte";
  import type { ViewerCompanionSurfaceProps } from "./viewer-split-pane-types";
  import SequenceVideos from "./sequence-videos/SequenceVideos.svelte";

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
    onPropChange,
    onRenderProgress,
    onUnfocusPane,
    onStepClick,
    onQrPlayClick,
    onChoreoCardContextMenu,
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
  }: ViewerCompanionSurfaceProps = $props();

  const selectedPane = $derived(
    side === "left" ? splitConfig.leftPane : splitConfig.rightPane
  );
  const card = createPaneKeepAlive(() => selectedPane === "card");
  const videos = createPaneKeepAlive(() => selectedPane === "videos");
  const mandala = createPaneKeepAlive(() => selectedPane === "mandala");
  const tunnel = createPaneKeepAlive(() => selectedPane === "tunnel");

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
      {onStepClick}
      {onQrPlayClick}
      clickableStart
      {onRenderProgress}
      showWord={imageComposition.showWord}
      showStepNumbers={imageComposition.showStepNumbers}
      showDifficultyLevel={imageComposition.showDifficulty}
      includeStartPosition={imageComposition.showStartPos}
      showNotes={imageComposition.showNotes}
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
      bluePropType={propRendering.bluePropType}
      redPropType={propRendering.redPropType}
      catDogModeEnabled={propRendering.catDogModeEnabled}
      {rerenderTrigger}
      onContextMenu={onChoreoCardContextMenu}
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
      active={side === "right" ? mandala.shown : true}
      shown={mandala.shown}
      {sequence}
      {playback}
      bluePropType={propRendering.bluePropType != null
        ? String(propRendering.bluePropType)
        : undefined}
      redPropType={propRendering.redPropType != null
        ? String(propRendering.redPropType)
        : undefined}
      {bpm}
      {onBpmChange}
      {playbackMode}
      {onPlaybackModeChange}
      onPlaybackToggle={onPlaybackToggle ?? (() => {})}
      layout={layout.isMobile ? "bottom" : "sidebar"}
      {onPropChange}
      {onArtExport}
      {onArtShare}
      {artShareActive}
      {onArtExportEvent}
      {onArtSettingChange}
      {onArtAction}
    />
  </div>
{/if}

{#if tunnel.mounted}
  <div
    class="media-pane content-overlay"
    class:content-overlay-hidden={!tunnel.shown}
  >
    <ArtPane
      artType="tunnel"
      active={side === "right" ? tunnel.shown : true}
      shown={tunnel.shown}
      {sequence}
      {playback}
      bluePropType={propRendering.bluePropType != null
        ? String(propRendering.bluePropType)
        : undefined}
      redPropType={propRendering.redPropType != null
        ? String(propRendering.redPropType)
        : undefined}
      {bpm}
      {onBpmChange}
      {playbackMode}
      {onPlaybackModeChange}
      onPlaybackToggle={onPlaybackToggle ?? (() => {})}
      layout={layout.isMobile ? "bottom" : "sidebar"}
      {onPropChange}
      {onArtExport}
      {onArtShare}
      {artShareActive}
      {onArtExportEvent}
      {onArtSettingChange}
      {onArtAction}
    />
  </div>
{/if}
