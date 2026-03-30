<!--
  /sequence/[id]/+page.svelte

  Dedicated sequence viewer route - the canonical way to view sequences.
  Uses SequenceViewerOrchestrator for all shared state/logic, keeping only
  route-specific concerns:
  - URL param parsing and state restoration
  - Sequence loading (handoff, encoded URL, legacy ID)
  - initializeAppServices() for standalone access
  - SSR metadata (<svelte:head>)
  - View Transitions
  - Swipe-to-dismiss gesture (all viewports)
  - DrawerStack registration (blocks pull-to-refresh)
  - Browse gallery background (mobile drawer effect)
-->
<script lang="ts">
  import { page } from "$app/stores";
  import { goto, replaceState } from "$app/navigation";
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { ILetterDeriver } from "$lib/shared/navigation/services/contracts/ILetterDeriver";
  import type { IPositionDeriver } from "$lib/shared/navigation/services/contracts/IPositionDeriver";
  import { initializeAppServices } from "$lib/shared/application/state/services.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { setSkipNextViewTransition } from "$lib/shared/transitions/sequence-drawer-state.svelte";
  import { registerDrawer, unregisterDrawer, generateDrawerId } from "$lib/shared/foundation/ui/drawer/DrawerStack";
  import { createModalSwipeDismiss } from "$lib/shared/sequence-viewer/services/implementations/ModalSwipeDismiss";
  import {
    consumeSequenceRouteHandoff,
    type SequenceRouteHandoff
  } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import { playbackTimeCalculator } from "$lib/shared/sequence-viewer/services/implementations/PlaybackTimeCalculator";
  import SequenceViewerOrchestrator from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";
  import type { OrchestratorContext } from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";

  // Components
  import ViewerSplitPane from "$lib/shared/sequence-viewer/components/ViewerSplitPane.svelte";
  import ViewerFooter from "$lib/shared/sequence-viewer/components/ViewerFooter.svelte";
  import FullscreenControls from "$lib/shared/sequence-viewer/components/FullscreenControls.svelte";
  import ExportVideoDrawer from "$lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte";
  import ExportImagePanel from "$lib/shared/sequence-viewer/components/ExportImagePanel.svelte";
  import VideoPreviewPanel from "$lib/shared/sequence-viewer/components/VideoPreviewPanel.svelte";
  import PracticeProgressIndicator from "$lib/shared/sequence-viewer/components/PracticeProgressIndicator.svelte";
  import RouteViewerHeader from "./RouteViewerHeader.svelte";
  import DeleteConfirmDialog from "$lib/shared/sequence-viewer/components/DeleteConfirmDialog.svelte";

  import { getIabBannerVisible, IAB_BANNER_HEIGHT } from "$lib/shared/auth/state/iab-banner-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";
  import ChoreoCardContextMenuHost from "$lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";
  import CardSettingsModal from "$lib/features/choreo-card/components/CardSettingsModal.svelte";
  import {
    openSendSequenceSheet,
    buildSequenceSharePayload,
    buildThumbnailUrl,
  } from "$lib/shared/inbox/state/send-sequence-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  // ============================================================================
  // ROUTE-SPECIFIC STATE
  // ============================================================================

  // Route params
  const sequenceId = $derived($page.params.id);

  // URL params for state restoration
  const urlViewMode = $derived($page.url.searchParams.get("view") as "animation" | "image" | "split" | null);
  const urlBpm = $derived(parseInt($page.url.searchParams.get("bpm") || "") || null);
  const urlTime = $derived(parseInt($page.url.searchParams.get("t") || "") || null);

  // URL metadata params (from share URLs)
  const urlWord = $derived($page.url.searchParams.get("word"));
  const urlCreator = $derived($page.url.searchParams.get("creator"));
  const urlNotes = $derived($page.url.searchParams.get("notes"));
  const urlDarkMode = $derived($page.url.searchParams.get("dark"));
  const urlDifficulty = $derived($page.url.searchParams.get("difficulty"));
  const urlBirthday = $derived($page.url.searchParams.get("birthday"));

  // URL prop params (from QR codes with prop info)
  const urlBlueProp = $derived($page.url.searchParams.get("bp"));
  const urlRedProp = $derived($page.url.searchParams.get("rp"));

  // Guest preview mode — forces unauthenticated view for debugging shared link UX
  const forceGuest = $derived($page.url.searchParams.get("guest") === "1");

  // Sequence loading state
  let sequence = $state<SequenceData | null>(null);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);
  let handoffData = $state<SequenceRouteHandoff | null>(null);

  // IAB banner padding
  const iabBannerShowing = $derived(getIabBannerVisible());

  // Mobile detection
  let isMobile = $state(false);

  // Swipe-to-dismiss (works at all viewport sizes)
  const swipeDismiss = createModalSwipeDismiss();
  let currentSwipeY = $state(0);
  let currentIsSwiping = $state(false);

  // Page container ref for swipe visual feedback
  let pageContainer: HTMLElement | null = $state(null);

  // Delete confirmation state
  let deleteConfirmOpen = $state(false);
  let isDeleting = $state(false);

  // ChoreoCard context menu + settings modal
  let choreoCardMenuHost: ChoreoCardContextMenuHost | undefined = $state();
  let cardSettingsOpen = $state(false);

  // DrawerStack registration - blocks pull-to-refresh on mobile
  const drawerId = generateDrawerId();

  // Track if orchestrator needs to restore time from URL after init
  let pendingTimeRestore = $state<number | null>(null);

  // Cleanup
  let resizeCleanup: (() => void) | null = null;

  function handleSendTo() {
    const seq = sequence;
    if (!seq) return;
    const propType = seq.intendedProp?.bluePropType ?? settingsService.settings.bluePropType ?? "staff";
    const thumbnailUrl = buildThumbnailUrl(seq.word || seq.name, String(propType), false);
    openSendSequenceSheet(buildSequenceSharePayload({ ...seq, thumbnailUrl }));
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(async () => {
    // Non-blocking: settings sync happens in background.
    // Don't block the viewer on service initialization.
    initializeAppServices().catch(() => {});

    // Mobile detection
    const checkMobile = () => { isMobile = window.innerWidth < 768; };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    resizeCleanup = () => window.removeEventListener("resize", checkMobile);

    // Block pull-to-refresh on mobile
    if (isMobile) {
      registerDrawer(drawerId, handleBack);
    }

    // Start sequence loading immediately — don't wait for services
    void initializeRoute();
  });

  onDestroy(() => {
    unregisterDrawer(drawerId);
    resizeCleanup?.();
    swipeDismiss.dispose();
  });

  // Apply visual feedback during swipe gesture
  $effect(() => {
    if (!pageContainer) return;
    if (currentIsSwiping && currentSwipeY > 0) {
      pageContainer.style.transform = `translateY(${currentSwipeY}px)`;
      pageContainer.style.opacity = `${Math.max(0.3, 1 - currentSwipeY / 300)}`;
      pageContainer.style.transition = "none";
    } else if (!currentIsSwiping) {
      pageContainer.style.transform = "";
      pageContainer.style.opacity = "";
      pageContainer.style.transition = "";
    }
  });

  // ============================================================================
  // METADATA RESTORATION
  // ============================================================================

  /** Apply URL metadata params to a decoded sequence (fills in data lost during encoding). */
  function applyUrlMetadata(seq: SequenceData): SequenceData {
    // Build a mutable updates object and cast to Partial<SequenceData>
    // since updateSequenceData uses spread which bypasses readonly
    const updates: Record<string, unknown> = {};

    if (urlWord && !seq.word) updates.word = urlWord;
    if (urlCreator && !seq.ownerDisplayName) updates.ownerDisplayName = urlCreator;
    if (urlDifficulty && !seq.difficultyLevel) updates.difficultyLevel = urlDifficulty;

    if (urlNotes) {
      updates.metadata = { ...seq.metadata, notes: urlNotes };
    }

    if (urlBirthday && !seq.birthday) {
      // Parse YYYYMMDD back into a Date — restore to birthday (original creation date),
      // not createdAt (when added to library), so the field round-trips correctly
      const y = urlBirthday.slice(0, 4);
      const m = urlBirthday.slice(4, 6);
      const d = urlBirthday.slice(6, 8);
      const date = new Date(`${y}-${m}-${d}`);
      if (!isNaN(date.getTime())) {
        updates.birthday = date;
      }
    }

    if (Object.keys(updates).length === 0) return seq;
    return { ...seq, ...updates } as SequenceData;
  }

  /**
   * Apply URL prop preferences to settings state.
   * Uses PROP_TYPE_DECODE mapping (single char -> PropType).
   */
  function applyUrlPropPreferences() {
    if (!urlBlueProp && !urlRedProp) return;

    const encoderService = container.items.sequenceEncoder;
    const parsed = encoderService.parsePropsFromURL($page.url.searchParams);

    if (parsed.bluePropType || parsed.redPropType) {
      const settingsService = container.items.settingsState;
      const updates: { bluePropType?: PropType; redPropType?: PropType } = {};

      if (parsed.bluePropType) {
        updates.bluePropType = parsed.bluePropType as PropType;
      }
      if (parsed.redPropType) {
        updates.redPropType = parsed.redPropType as PropType;
      }

      settingsService.updateSettings(updates);
    }
  }

  /**
   * Fire-and-forget: compute encoderHash, query publicSequences, enrich viewer.
   * If it fails (offline, no match, error), the viewer works fine from URL data alone.
   */
  async function matchPublicRecord(seq: SequenceData) {
    try {
      const matcher = container.items.publicSequenceHashMatcher;
      const result = await matcher.findPublicMatch(seq);

      if (result.matched && result.publicRecord) {
        const pub = result.publicRecord;
        sequence = {
          ...seq,
          ownerId: pub.ownerId,
          ownerDisplayName: pub.ownerDisplayName,
          intendedProp: seq.intendedProp,
          creatorIntent: pub.creatorIntent ?? undefined,
          word: seq.word || pub.word,
          name: seq.name === "Shared Sequence" ? pub.name : seq.name,
        } as SequenceData;
      }
    } catch {
      // Silent failure — progressive enhancement only
    }
  }

  // ============================================================================
  // SEQUENCE LOADING
  // ============================================================================

  async function initializeRoute() {
    // Try handoff data first (from Browse gallery)
    handoffData = consumeSequenceRouteHandoff();

    if (handoffData?.sequence) {
      sequence = handoffData.sequence;
      // Apply URL prop preferences even when using handoff (QR might have props)
      applyUrlPropPreferences();
      isLoading = false;
    } else if (sequenceId) {
      const encoderService = container.items.sequenceEncoder;
      const parsed = encoderService.parseSequenceRouteId(sequenceId);

      if (parsed.encoded) {
        try {
          let decoded = encoderService.decodeWithCompression(parsed.encoded);

          const letterDeriver = container.items.letterDeriver as ILetterDeriver | null;
          const positionDeriver = container.items.positionDeriver as IPositionDeriver | null;

          if (letterDeriver) {
            decoded = await letterDeriver.deriveLettersForSequence(decoded);
          }
          if (positionDeriver) {
            decoded = await positionDeriver.derivePositionsForSequence(decoded);
          }

          sequence = applyUrlMetadata(decoded);

          // Apply URL dark mode preference before the orchestrator mounts
          if (urlDarkMode !== null) {
            const imageComposition = getImageCompositionManager();
            imageComposition.setDarkMode(urlDarkMode === "1");
          }

          // Apply URL prop preferences (from QR codes with embedded prop info)
          applyUrlPropPreferences();

          isLoading = false;

          // Background: try to match against public library for attribution
          void matchPublicRecord(sequence!);
        } catch (err) {
          console.error("[SequenceRoute] Failed to decode sequence from URL:", err);
          loadError = "Invalid sequence URL";
          isLoading = false;
        }
      } else if (parsed.legacyId) {
        await loadSequenceFromId(parsed.legacyId);
      } else {
        loadError = "No sequence data in URL";
        isLoading = false;
      }
    } else {
      loadError = "No sequence ID provided";
      isLoading = false;
    }

    // Store pending time restore from URL (orchestrator will handle after animation init)
    if (urlTime) {
      pendingTimeRestore = urlTime;
    }
  }

  async function loadSequenceFromId(id: string) {
    isLoading = true;
    loadError = null;

    try {
      const encoderService = container.items.sequenceEncoder;

      if (encoderService.isInlineEncoded(id)) {
        try {
          const decoded = encoderService.decodeWithCompression(decodeURIComponent(id));
          if (decoded) {
            sequence = decoded;
            isLoading = false;
            return;
          }
        } catch {
          // Not a valid encoded sequence, continue
        }
      }

      const shortCodeManager = container.items.shortCodeManager;
      let resolvedSequence = await shortCodeManager.resolveShortCode(id);

      if (!resolvedSequence) {
        const provider = container.items.sequenceDataProvider;
        resolvedSequence = await provider.loadByIdentifier(id);
      }

      // Try user's Firestore library (e.g. sync room IDs are Firestore doc IDs)
      if (!resolvedSequence) {
        try {
          const libraryRepo = container.items.libraryRepository;
          resolvedSequence = await libraryRepo.getSequence(id);
        } catch {
          // Library lookup failed (not logged in, etc.)
        }
      }

      if (!resolvedSequence) {
        loadError = "It may have been deleted by the owner while you were browsing the feed.";
        isLoading = false;
        return;
      }

      sequence = resolvedSequence;
      // Apply URL prop preferences (from QR codes with embedded prop info)
      applyUrlPropPreferences();
      isLoading = false;
    } catch (err) {
      console.error("[SequenceRoute] Failed to load sequence:", err);
      loadError = "Failed to load sequence";
      isLoading = false;
    }
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  function handleBack() {
    const returnPath = handoffData?.returnPath || "/browse/gallery";
    goto(returnPath);
  }

  // ============================================================================
  // SWIPE HANDLING (ALL VIEWPORTS)
  // ============================================================================

  function handleTouchStart(e: TouchEvent, ctx: OrchestratorContext) {
    if (ctx.isFullscreen || ctx.isExportMode) return;
    swipeDismiss.handleTouchStart(e);
  }

  function handleTouchMove(e: TouchEvent, ctx: OrchestratorContext) {
    if (ctx.isFullscreen || ctx.isExportMode) return;
    const handled = swipeDismiss.handleTouchMove(e);
    currentSwipeY = swipeDismiss.state.swipeY;
    currentIsSwiping = swipeDismiss.state.isSwiping;
    if (handled && e.cancelable) {
      e.preventDefault();
    }
  }

  async function handleTouchEnd(ctx: OrchestratorContext) {
    const shouldDismiss = swipeDismiss.handleTouchEnd();
    if (shouldDismiss) {
      if (pageContainer) {
        pageContainer.style.transition = "transform 200ms ease-out, opacity 200ms ease-out";
        pageContainer.style.transform = "translateY(100%)";
        pageContainer.style.opacity = "0";
        await new Promise((r) => setTimeout(r, 200));
      }
      setSkipNextViewTransition();
      ctx.onBack();
    } else {
      currentSwipeY = 0;
      currentIsSwiping = false;
    }
  }

  // ============================================================================
  // EXPORT HELPERS
  // ============================================================================

  // ============================================================================
  // URL HELPERS
  // ============================================================================

  function updateUrlParam(key: string, value: string) {
    if (!browser) return;
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    replaceState(url.toString(), {});
  }
</script>

<svelte:head>
  <title>{sequence?.word || sequence?.name || "Sequence"} - TKA Composer</title>
  <meta
    name="description"
    content={sequence?.word
      ? `View the "${sequence.word}" flow sequence in TKA Composer`
      : "View this flow sequence in TKA Composer"}
  />
</svelte:head>

{#if isLoading}
  <div class="sequence-route-page">
    <div class="loading-container">
      <LoadingGate variant="card" message="Loading sequence..." />
    </div>
  </div>
{:else if loadError || !sequence}
  <div class="sequence-route-page">
    <div class="error-container">
      <div class="error-card">
        <i class="fas fa-exclamation-circle error-icon" aria-hidden="true"></i>
        <h1>Sequence Not Found</h1>
        <p>{loadError || "This sequence could not be loaded."}</p>
        <button class="back-button" onclick={() => goto("/browse/gallery")}>
          Browse Sequences
        </button>
      </div>
    </div>
  </div>
{:else}
  <SequenceViewerOrchestrator
    {sequence}
    {isMobile}
    {forceGuest}
    initialBpm={urlBpm || handoffData?.playbackState?.bpm || 60}
    initialStep={handoffData?.playbackState?.currentStep || 0}
    initialViewMode={urlViewMode || undefined}
    onBack={handleBack}
    onUrlParamChange={updateUrlParam}
    blockClicks={swipeDismiss.state.blockClicks}
  >
    {#snippet children(ctx)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="sequence-route-page"
        bind:this={pageContainer}
        data-fullscreen={ctx.isFullscreen}
        style:padding-bottom={iabBannerShowing ? `${IAB_BANNER_HEIGHT}px` : undefined}
        ontouchstart={(e) => handleTouchStart(e, ctx)}
        ontouchmove={(e) => handleTouchMove(e, ctx)}
        ontouchend={() => handleTouchEnd(ctx)}
      >
        <!-- Header -->
        <RouteViewerHeader
          editingPane={ctx.editingPane}
          isFullscreen={ctx.isFullscreen}
          {isMobile}
          returnLabel={handoffData?.returnLabel || "Back"}
          onBack={ctx.onBack}
          onExitEditMode={ctx.exitEditMode}
          sequence={sequence}
        />

        <!-- Main content -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="route-body-content"
          data-fullscreen={ctx.isFullscreen}
          style:view-transition-name="sequence-{sequence?.id || 'viewer'}"
          onclick={ctx.isFullscreen ? ctx.handleFullscreenTap : undefined}
          onkeydown={ctx.isFullscreen ? (e) => { if (e.key === 'Enter' || e.key === ' ') ctx.handleFullscreenTap(); } : undefined}
          role={ctx.isFullscreen ? "button" : undefined}
          tabindex={ctx.isFullscreen ? 0 : undefined}
        >
          {#if ctx.isFullscreen}
            <FullscreenControls
              visible={ctx.fullscreenControlsVisible}
              viewMode={ctx.viewMode}
              isPlaying={ctx.isPlayingLocal}
              bpm={ctx.bpmLocal}
              onExit={ctx.exitFullscreen}
              onPlaybackToggle={ctx.handlePlaybackToggle}
              onStepHalfBeatBackward={ctx.stepHalfBeatBackward}
              onStepHalfBeatForward={ctx.stepHalfBeatForward}
              onStepFullBeatBackward={ctx.stepFullBeatBackward}
              onStepFullBeatForward={ctx.stepFullBeatForward}
              onRestartToStart={ctx.restartToStart}
              onBpmChange={ctx.handleBpmChange}
            />
          {/if}

          {#if ctx.hasSequence && ctx.effectiveSequence}
            {@const isVideoExportActive = ctx.editingPane === "animation"}
            {@const isImageExportActive = ctx.editingPane === "image"}
            {@const isAnyExportActive = isVideoExportActive || isImageExportActive}
            <div
              class="viewer-and-export"
              class:export-active={isAnyExportActive}
              class:desktop={!isMobile}
            >
              <!-- Single persistent ViewerSplitPane — never destroyed, CSS grid transitions handle focus -->
              <ViewerSplitPane
                sequence={ctx.effectiveSequence}
                playback={ctx.splitPanePlayback}
                imageComposition={isImageExportActive
                  ? {
                      showWord: ctx.exportOptions.imageShowWord,
                      showStepNumbers: ctx.exportOptions.imageShowStepNumbers,
                      showDifficulty: ctx.exportOptions.imageShowDifficulty,
                      showStartPos: ctx.exportOptions.imageIncludeStartPosition,
                      showCreatorName: ctx.exportOptions.imageShowCreatorName,
                      showNotes: ctx.exportOptions.imageShowNotes,
                      showBirthday: ctx.splitPaneImageComposition.showBirthday,
                      showQRCode: ctx.exportOptions.imageShowQRCode,
                      darkMode: ctx.exportOptions.imageDarkMode,
                      columnCount: ctx.exportOptions.imageColumnCount != null
                        ? ctx.exportOptions.imageColumnCount + (ctx.exportOptions.imageIncludeStartPosition ? 1 : 0)
                        : null,
                      forceContain: true,
                      userName: ctx.splitPaneImageComposition.userName,
                    }
                  : ctx.splitPaneImageComposition}
                propRendering={ctx.splitPanePropRendering}
                layout={{
                  isFullscreen: ctx.isFullscreen,
                  fullscreenStackVertical: ctx.fullscreenStackVertical,
                  isMobile,
                  isLandscapeMobile: false,
                  focusedPane: ctx.editingPane,
                  suppressCloseButton: ctx.editingPane !== null,
                }}
                onFocusPane={ctx.enterEditMode}
                onUnfocusPane={ctx.exitEditMode}
                onStepClick={ctx.handleStepClick}
                onCanvasReady={ctx.handleCanvasReady}
                onChoreoCardContextMenu={(x, y) => choreoCardMenuHost?.openContextMenu(x, y)}
              />
              <ChoreoCardContextMenuHost
                bind:this={choreoCardMenuHost}
                onOpenSettings={() => { cardSettingsOpen = true; }}
                isExportMode={isImageExportActive}
                exportOptions={ctx.exportOptions}
                onSendTo={sequence ? handleSendTo : undefined}
                stepCount={sequence?.steps?.length ?? 0}
              />
              <CardSettingsModal bind:open={cardSettingsOpen} {sequence} />
              {#if isAnyExportActive}
                <div class="export-panel-container" class:sidebar={!isMobile && isVideoExportActive} transition:fade={{ duration: 200 }}>
                  {#if isVideoExportActive}
                    {#if ctx.previewBlobUrl}
                      <VideoPreviewPanel
                        blobUrl={ctx.previewBlobUrl}
                        onDismiss={ctx.dismissPreview}
                        onRedownload={() => {
                          const a = document.createElement("a");
                          a.href = ctx.previewBlobUrl!;
                          a.download = `${ctx.effectiveSequence?.word || "sequence"}.mp4`;
                          a.click();
                        }}
                      />
                    {:else}
                      <ExportVideoDrawer
                        exportOptions={ctx.exportOptions}
                        isExporting={ctx.isExporting}
                        exportProgress={ctx.exportProgress}
                        canvasReady={ctx.canvasReady}
                        layout={isMobile ? "bottom" : "sidebar"}
                        singlePlayDuration={ctx.singlePlayDuration}
                        isPlaying={ctx.isPlayingLocal}
                        bpm={ctx.bpmLocal}
                        onPlaybackToggle={ctx.handlePlaybackToggle}
                        onBpmChange={ctx.handleBpmChange}
                        onExport={ctx.handleExport}
                        onCancel={ctx.handleCancelExport}
                      />
                    {/if}
                  {:else if isImageExportActive}
                    <ExportImagePanel
                      exportOptions={ctx.exportOptions}
                      isExporting={ctx.isExporting}
                      beatCount={ctx.effectiveSequence?.steps?.length ?? 0}
                      onExport={ctx.handleExport}
                      onClose={ctx.exitEditMode}
                    />
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Footer: CSS collapse (not Svelte transition) so height change is gradual -->
        {#if !ctx.isFullscreen}
          <div class="footer-collapse" class:collapsed={!!ctx.editingPane}>
            <ViewerFooter
              bpm={ctx.bpmLocal}
              isPlaying={ctx.isPlayingLocal}
              isLoggedIn={ctx.isLoggedIn}
              practiceActive={ctx.practiceActive}
              onBpmChange={ctx.handleBpmChange}
              onPlayPause={ctx.handlePlaybackToggle}
              onStepBack={ctx.stepFullBeatBackward}
              onStepForward={ctx.stepFullBeatForward}
              onStepHalfBack={ctx.stepHalfBeatBackward}
              onStepHalfForward={ctx.stepHalfBeatForward}
              onRestartToStart={ctx.restartToStart}
              onSave={ctx.handleSave}
              onEdit={ctx.handleEdit}
              onGetApp={ctx.handleGetApp}
              onPracticeStart={ctx.handlePracticeStart}
              onPracticeStop={ctx.handlePracticeStop}
              isOwned={ctx.isOwned}
              onDeleteRequest={() => (deleteConfirmOpen = true)}
              isSaved={ctx.isSaved}
              isPublished={ctx.isPublished}
              isFavorite={ctx.isFavorite}
              onFavorite={ctx.handleFavoriteToggle}
              onPublish={ctx.handlePublishAction}
              onUnpublish={ctx.handleUnpublishAction}
            />
            {#if ctx.practiceActive}
              <PracticeProgressIndicator
                progress={ctx.practiceState.progress}
                onStop={ctx.handlePracticeStop}
                variant="floating"
              />
            {/if}
          </div>
        {/if}
      </div>

      {#if deleteConfirmOpen}
        <DeleteConfirmDialog
          word={sequence?.word}
          {isDeleting}
          positioning="fixed"
          onConfirm={async () => {
            isDeleting = true;
            try {
              await ctx.handleDelete();
            } finally {
              deleteConfirmOpen = false;
              isDeleting = false;
            }
          }}
          onCancel={() => (deleteConfirmOpen = false)}
        />
      {/if}
    {/snippet}
  </SequenceViewerOrchestrator>
{/if}

<style>
  .sequence-route-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  .route-body-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .route-body-content[data-fullscreen="true"] {
    position: relative;
  }

  /* Loading state */
  .loading-container {
    flex: 1;
    position: relative;
  }

  /* Error state */
  .error-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .error-card {
    text-align: center;
    padding: 2rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 1rem;
    max-width: 400px;
  }

  .error-icon {
    font-size: 48px;
    color: var(--semantic-error, #ef4444);
    margin-bottom: 1rem;
  }

  .error-card h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0 0 0.5rem 0;
  }

  .error-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0 0 1.5rem 0;
    font-size: var(--font-size-sm, 14px);
  }

  .back-button {
    min-height: var(--min-touch-target);
    padding: 0.75rem 1.5rem;
    background: var(--theme-accent, #f43f5e);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: filter var(--duration-normal, 200ms) ease;
  }

  .back-button:hover {
    filter: brightness(1.1);
  }

  .back-button:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  /* Viewer + export panel container.
     Flex child fills remaining space. Export panel overlays the right side. */
  .viewer-and-export {
    --export-sidebar-width: 320px;
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Export panel — absolute overlay so it doesn't steal width from split pane */
  .export-panel-container {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: var(--export-sidebar-width);
    z-index: 5;
    overflow: hidden;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Mobile: export panel is inline in flex layout, not absolute */
  @media (max-width: 767px) {
    .viewer-and-export.export-active {
      display: flex;
      flex-direction: column;
    }

    .export-panel-container {
      position: relative;
      top: auto;
      right: auto;
      bottom: auto;
      left: auto;
      width: 100%;
      flex-shrink: 0;
      overflow: visible;
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }
  }

  /* Footer — CSS grid row collapse for smooth height animation.
     grid-template-rows: 1fr → 0fr collapses without layout jumps. */
  .footer-collapse {
    display: grid;
    grid-template-rows: 1fr;
    transition: grid-template-rows 250ms cubic-bezier(0.2, 0, 0, 1),
                opacity 250ms cubic-bezier(0.2, 0, 0, 1);
  }

  .footer-collapse > :global(*) {
    overflow: hidden;
  }

  .footer-collapse.collapsed {
    grid-template-rows: 0fr;
    opacity: 0;
    pointer-events: none;
  }

  /* Mobile drawer appearance */
  @media (max-width: 767px) {
    .sequence-route-page {
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
      background: var(--theme-panel-bg, #0a0a14);
      overflow: hidden;
      overscroll-behavior-y: contain;
      touch-action: pan-y;
    }

    /* Suppress morph view-transition-name on mobile so the drawer
       slide-up doesn't fight with a morph animation */
    .route-body-content {
      view-transition-name: none !important;
    }
  }

</style>
