<!--
  /p/[code]/+page.svelte

  QR Code Resolver + Inline Viewer

  Resolves short codes from QR scans and renders the sequence viewer
  directly — no redirect to /sequence/[id]. This eliminates a full
  page navigation and JS reload, making QR scans feel instant.

  URL format: /p/{shortCode}

  Flow:
  1. Resolve short code to SequenceData (Firebase or inline-encoded)
  2. Track scan count (Firebase codes only, fire-and-forget)
  3. Render SequenceViewerOrchestrator inline
  4. Cosmetically update URL via SvelteKit's replaceState()
-->
<script lang="ts">
  import { page } from "$app/stores";
  import { goto, replaceState } from "$app/navigation";
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { container } from "$lib/shared/di";
  import { captureEvent } from "$lib/shared/analytics/services/posthog";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { ILetterDeriver } from "$lib/shared/navigation/services/contracts/ILetterDeriver";
  import type { IPositionDeriver } from "$lib/shared/navigation/services/contracts/IPositionDeriver";
  import { initializeAppServices } from "$lib/shared/application/state/services.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { setSkipNextViewTransition } from "$lib/shared/transitions/sequence-drawer-state.svelte";
  import { registerDrawer, unregisterDrawer, generateDrawerId } from "$lib/shared/foundation/ui/drawer/DrawerStack";
  import { createModalSwipeDismiss } from "$lib/shared/sequence-viewer/services/implementations/ModalSwipeDismiss";
  import { getIabBannerVisible, IAB_BANNER_HEIGHT } from "$lib/shared/auth/state/iab-banner-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    openSendSequenceSheet,
    buildSequenceSharePayload,
    buildThumbnailUrl,
  } from "$lib/shared/inbox/state/send-sequence-state.svelte";

  // Components
  import SequenceViewerOrchestrator from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";
  import type { OrchestratorContext } from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";
  import ViewerSplitPane from "$lib/shared/sequence-viewer/components/ViewerSplitPane.svelte";
  import ViewerFooter from "$lib/shared/sequence-viewer/components/ViewerFooter.svelte";
  import FullscreenControls from "$lib/shared/sequence-viewer/components/FullscreenControls.svelte";
  import ExportVideoDrawer from "$lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte";
  import ExportImagePanel from "$lib/shared/sequence-viewer/components/ExportImagePanel.svelte";
  import VideoPreviewPanel from "$lib/shared/sequence-viewer/components/VideoPreviewPanel.svelte";
  import PracticeProgressIndicator from "$lib/shared/sequence-viewer/components/PracticeProgressIndicator.svelte";
  import RouteViewerHeader from "../../sequence/[id]/RouteViewerHeader.svelte";
  import DeleteConfirmDialog from "$lib/shared/sequence-viewer/components/DeleteConfirmDialog.svelte";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";
  import ChoreoCardContextMenuHost from "$lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";
  import CardSettingsModal from "$lib/features/choreo-card/components/CardSettingsModal.svelte";

  // ============================================================================
  // PAGE DATA (from +page.server.ts — Cloudflare geo headers)
  // ============================================================================

  interface Props {
    data: {
      geo: {
        country: string | null;
        city: string | null;
      };
    };
  }

  const { data }: Props = $props();

  // ============================================================================
  // ROUTE-SPECIFIC STATE
  // ============================================================================

  // Short code from URL param
  const shortCode = $derived($page.params["code"]);

  // Guest preview mode — forces unauthenticated view for debugging shared link UX
  const forceGuest = $derived($page.url.searchParams.get("guest") === "1");

  // URL prop params (from QR codes with prop info)
  const urlBlueProp = $derived($page.url.searchParams.get("bp"));
  const urlRedProp = $derived($page.url.searchParams.get("rp"));

  // URL metadata params (from share URLs)
  const urlDarkMode = $derived($page.url.searchParams.get("dark"));

  // IAB banner padding (in-app browsers like Instagram, Facebook)
  const iabBannerShowing = $derived(getIabBannerVisible());

  // Sequence loading state
  let sequence = $state<SequenceData | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let errorDiagnostics = $state<string | null>(null);

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

  // Cleanup
  let resizeCleanup: (() => void) | null = null;

  // ============================================================================
  // SEND-TO HANDLER
  // ============================================================================

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
    // Initialize app services non-blocking (fire and forget).
    // The viewer can render before services are fully ready.
    initializeAppServices().catch((err) => {
      console.warn("[QR Resolver] Background service init failed:", err);
    });

    // Mobile detection
    const checkMobile = () => { isMobile = window.innerWidth < 768; };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    resizeCleanup = () => window.removeEventListener("resize", checkMobile);

    // Block pull-to-refresh on mobile
    if (isMobile) {
      registerDrawer(drawerId, handleBack);
    }

    // Resolve the short code
    await resolveShortCode();
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
  // SHORT CODE RESOLUTION
  // ============================================================================

  async function resolveShortCode() {
    if (!shortCode) {
      error = "No short code provided";
      isLoading = false;
      return;
    }

    try {
      const shortCodeManager = container.items.shortCodeManager;
      const sequenceEncoder = container.items.sequenceEncoder;

      // Resolve short code to sequence
      // Handles both formats:
      // - s~{encodedData} -> offline decode (no Firebase needed)
      // - {shortCode} -> Firebase lookup (traditional)
      let resolved = await shortCodeManager.resolveShortCode(shortCode);

      if (!resolved) {
        // Capture diagnostics for the error screen so we can debug without DevTools
        try {
          const analytics = await shortCodeManager.getAnalytics(shortCode);
          errorDiagnostics = analytics
            ? `Code: ${shortCode} | Word: ${analytics.sequence} | Name: ${analytics.sequenceName ?? "?"}`
            : `Code: ${shortCode} | Record not found in Firestore`;
        } catch {
          errorDiagnostics = `Code: ${shortCode} | Failed to read record`;
        }
        error = "Sequence not found";
        isLoading = false;
        return;
      }

      // Track scan count for Firebase-backed short codes (not offline codes)
      if (!sequenceEncoder.isInlineEncoded(shortCode)) {
        shortCodeManager.incrementScanCount(shortCode).catch((err: unknown) => {
          console.warn("Failed to increment scan count:", err);
        });
      }

      // Fire scan analytics (fire-and-forget, never blocks the viewer)
      captureEvent("qr_code_scanned", {
        short_code: shortCode,
        print_id: new URL(window.location.href).searchParams.get("pid") || null,
        sequence_word: resolved.word,
        sequence_id: resolved.id,
        country: data?.geo?.country || null,
        city: data?.geo?.city || null,
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        referrer: document.referrer || null,
        is_deck_sequence: !resolved.ownerId,
      });

      // Log detailed scan event to Firestore subcollection
      shortCodeManager.logScanEvent(shortCode, {
        printId: new URL(window.location.href).searchParams.get("pid") || null,
        country: data?.geo?.country || null,
        city: data?.geo?.city || null,
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        referrer: document.referrer || null,
        userId: null,
      }).catch(() => {}); // Silent failure — analytics should never break the viewer

      // Derive letters and positions if services are available
      const letterDeriver = container.items.letterDeriver as ILetterDeriver | null;
      const positionDeriver = container.items.positionDeriver as IPositionDeriver | null;

      if (letterDeriver) {
        resolved = await letterDeriver.deriveLettersForSequence(resolved);
      }
      if (positionDeriver) {
        resolved = await positionDeriver.derivePositionsForSequence(resolved);
      }

      // Apply URL dark mode preference before the orchestrator mounts
      if (urlDarkMode !== null) {
        const imageComposition = getImageCompositionManager();
        imageComposition.setDarkMode(urlDarkMode === "1");
      }

      // Apply URL prop preferences (from QR codes with embedded prop info)
      applyUrlPropPreferences();

      // Store resolved sequence and show viewer
      sequence = resolved;
      isLoading = false;

      // Cosmetically update the URL to the canonical sequence path.
      // This does NOT trigger navigation — the viewer is already rendered.
      try {
        const routePath = sequenceEncoder.generateSequenceRoutePath(resolved);
        const currentSearch = window.location.search;
        replaceState(routePath + currentSearch, {});
      } catch {
        // Non-critical: viewer works fine without URL update
      }

      // Background: try to match against public library for attribution
      void matchPublicRecord(resolved);
    } catch (err: unknown) {
      console.error("Failed to resolve short code:", err);
      error = "Failed to load sequence";
      isLoading = false;
    }
  }

  // ============================================================================
  // PROP PREFERENCES
  // ============================================================================

  /**
   * Apply URL prop preferences to settings state.
   * Uses PROP_TYPE_DECODE mapping (single char -> PropType).
   */
  function applyUrlPropPreferences() {
    if (!urlBlueProp && !urlRedProp) return;

    const encoderService = container.items.sequenceEncoder;
    const parsed = encoderService.parsePropsFromURL($page.url.searchParams);

    if (parsed.bluePropType || parsed.redPropType) {
      const settingsState = container.items.settingsState;
      const updates: { bluePropType?: PropType; redPropType?: PropType } = {};

      if (parsed.bluePropType) {
        updates.bluePropType = parsed.bluePropType as PropType;
      }
      if (parsed.redPropType) {
        updates.redPropType = parsed.redPropType as PropType;
      }

      settingsState.updateSettings(updates);
    }
  }

  // ============================================================================
  // PUBLIC RECORD MATCHING
  // ============================================================================

  /**
   * Fire-and-forget: query publicSequences for attribution data.
   * If it fails (offline, no match, error), the viewer works fine from resolved data alone.
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
  // NAVIGATION
  // ============================================================================

  function handleBack() {
    // If user has browser history (came from another page), go back naturally.
    // Otherwise (QR scan opened a new tab), navigate to the gallery.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      goto("/browse/gallery");
    }
  }

  function handleGoHome() {
    goto("/browse/gallery");
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

  // No URL param updates needed for QR viewer — it's a read-only landing
  function updateUrlParam(_key: string, _value: string) {
    // Intentionally empty. QR scan viewers don't need URL state persistence.
  }
</script>

<svelte:head>
  {#if sequence}
    <title>{sequence.word || sequence.name || "Sequence"} - TKA Composer</title>
    <meta
      name="description"
      content={sequence.word
        ? `View the "${sequence.word}" flow sequence in TKA Composer`
        : "View this flow sequence in TKA Composer"}
    />
  {:else}
    <title>Loading... - TKA Composer</title>
    <meta name="description" content="Loading a flow sequence in TKA Composer" />
  {/if}
  <meta name="theme-color" content="#0f0f1a" />
</svelte:head>

{#if isLoading}
  <div class="resolver-page">
    <div class="loading-container">
      <LoadingGate variant="card" message="Loading sequence..." />
    </div>
  </div>
{:else if error || !sequence}
  <div class="resolver-page">
    <div class="error-container">
      <div class="error-card">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="error-icon"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h1>Sequence Not Found</h1>
        <p>{error || "This sequence could not be loaded."}</p>
        {#if errorDiagnostics}
          <p class="diagnostics">{errorDiagnostics}</p>
        {/if}
        <button class="home-button" onclick={handleGoHome} type="button">
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
    initialBpm={60}
    initialStep={0}
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
        ontouchstart={(e) => handleTouchStart(e, ctx)}
        ontouchmove={(e) => handleTouchMove(e, ctx)}
        ontouchend={() => handleTouchEnd(ctx)}
      >
        <!-- Header -->
        <RouteViewerHeader
          editingPane={ctx.editingPane}
          isFullscreen={ctx.isFullscreen}
          {isMobile}
          returnLabel="Back"
          onBack={ctx.onBack}
          onExitEditMode={ctx.exitEditMode}
          sequence={sequence}
        />

        <!-- Main content -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="route-body-content"
          data-fullscreen={ctx.isFullscreen}
          style:padding-bottom={iabBannerShowing ? `${IAB_BANNER_HEIGHT}px` : undefined}
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
              <!-- Single persistent ViewerSplitPane -->
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
                        playbackMode={ctx.playbackMode}
                        onPlaybackToggle={ctx.handlePlaybackToggle}
                        onPlaybackModeChange={ctx.handlePlaybackModeChange}
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

        <!-- Footer -->
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
  .resolver-page {
    min-height: 100vh;
    min-height: 100dvh;
    background: #0f0f1a;
    overflow: hidden;
  }

  .loading-container {
    min-height: 100vh;
    min-height: 100dvh;
    position: relative;
  }

  .error-container {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .error-card {
    text-align: center;
    padding: 2rem;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 1rem;
    max-width: 400px;
  }

  .error-icon {
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

  .diagnostics {
    font-family: monospace;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    word-break: break-all;
  }

  .home-button {
    min-height: var(--min-touch-target);
    padding: 0.75rem 1.5rem;
    background: var(--theme-accent, #f43f5e);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: background var(--duration-normal) ease;
  }

  .home-button:hover {
    filter: brightness(1.1);
  }

  .home-button:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  /* ================================================================
   * VIEWER LAYOUT (mirrors /sequence/[id] styles)
   * ================================================================ */

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

  /* Viewer + export panel container */
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

  /* Footer — CSS grid row collapse for smooth height animation */
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

    .route-body-content {
      view-transition-name: none !important;
    }
  }
</style>
