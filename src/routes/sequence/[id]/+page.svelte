<script lang="ts">

import { getLibraryRepository } from "$lib/shared/library/getLibraryRepository";
import { getDeviceId } from "$lib/shared/auth/services/device-id-service";
import { getSequenceDataProvider } from "$lib/shared/sequence-viewer/getSequenceDataProvider";
  import { page } from "$app/stores";
  import { goto, replaceState } from "$app/navigation";
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { fade } from "svelte/transition";
  import { getShortCodeManager } from "$lib/shared/qr/getShortCodeManager";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { hydrateSequence } from "$lib/shared/navigation/services/implementations/SequenceHydrator";
  import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
  import { gridModeDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridModeDeriver";
  import { parsePropsFromURL, parseSequenceRouteId, decodeSequenceWithCompression, isInlineEncoded } from "$lib/shared/navigation/services/sequence-encoder";
  import { decodeViewMode } from "$lib/shared/browse/domain/BrowseViewMode";
  import { getLetterDeriver } from "$lib/shared/navigation/getLetterDeriver";
  import { getPositionDeriver } from "$lib/shared/navigation/getPositionDeriver";
  import { getPublicSequenceHashMatcher } from "$lib/shared/sequence-viewer/getPublicSequenceHashMatcher";
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
  import RouteViewerHeader from "$lib/shared/sequence-viewer/components/RouteViewerHeader.svelte";
  import DeleteConfirmDialog from "$lib/shared/sequence-viewer/components/DeleteConfirmDialog.svelte";

  import { getIabBannerVisible, IAB_BANNER_HEIGHT } from "$lib/shared/auth/state/iab-banner-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";
  import ChoreoCardContextMenuHost from "$lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";
  import {
    openSendSequenceSheet,
    buildSequenceSharePayload,
    buildThumbnailUrl,
  } from "$lib/shared/inbox/state/send-sequence-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { sendToStickerLab } from "$lib/shared/sequence-viewer/services/send-to-sticker-lab";

  interface Props {
    data: {
      meta: {
        word: string | null;
        creator: string | null;
        difficulty: string | null;
        stepCount: number | null;
        thumbnailUrl: string | null;
      };
    };
  }

  const { data }: Props = $props();

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

  // URL render mode param (2D/3D)
  const urlRenderMode = $derived($page.url.searchParams.get("render") as '2d' | '3d' | null);

  // URL prop params (from QR codes with prop info)
  const urlBlueProp = $derived($page.url.searchParams.get("bp"));
  const urlRedProp = $derived($page.url.searchParams.get("rp"));

  // URL view mode param (from QR codes with browse view mode)
  const urlViewModeParam = $derived($page.url.searchParams.get("vm"));
  const decodedBrowseViewMode = $derived(urlViewModeParam ? decodeViewMode(urlViewModeParam) : null);
  const urlHandPathMode = $derived(decodedBrowseViewMode?.subject === "hands");
  const urlInitialBlueVisible = $derived(
    decodedBrowseViewMode?.granularity === "solo" ? decodedBrowseViewMode.color === "blue" : true
  );
  const urlInitialRedVisible = $derived(
    decodedBrowseViewMode?.granularity === "solo" ? decodedBrowseViewMode.color === "red" : true
  );

  // Guest preview mode - forces unauthenticated view for debugging shared link UX
  const forceGuest = $derived($page.url.searchParams.get("guest") === "1");

  // Sequence loading state
  let sequence = $state<SequenceData | null>(null);
  let isLoading = $state(true);
  let loadError = $state<string | null>(null);
  let handoffData = $state<SequenceRouteHandoff | null>(null);

  // OG meta tag values (SSR from server data, then enhanced client-side)
  const ogWord = $derived(sequence?.word || data?.meta?.word || "Sequence");
  const ogCreator = $derived(sequence?.ownerDisplayName || data?.meta?.creator || null);
  const ogDesc = $derived(
    ogCreator
      ? `Flow sequence by ${ogCreator}${data?.meta?.stepCount ? ` • ${data.meta.stepCount} beats` : ""}${data?.meta?.difficulty ? ` • Level ${data.meta.difficulty}` : ""}`
      : "View this flow sequence in TKA Composer"
  );
  const ogImage = $derived(data?.meta?.thumbnailUrl || "https://tkaflowarts.com/og-default.png");
  const ogUrl = $derived(`https://tkaflowarts.com/sequence/${sequenceId}`);

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

  // ChoreoCard context menu
  let choreoCardMenuHost: ChoreoCardContextMenuHost | undefined = $state();

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

  function handleSendToStickerLab() {
    const seq = sequence;
    if (!seq) return;
    sendToStickerLab(seq);
  }

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

    // Start sequence loading immediately - don't wait for services
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
      // Parse YYYYMMDD back into a Date - restore to birthday (original creation date),
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

    const parsed = parsePropsFromURL($page.url.searchParams);

    if (parsed.bluePropType || parsed.redPropType) {
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
      const matcher = getPublicSequenceHashMatcher();
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
      // Silent failure - progressive enhancement only
    }
  }

  async function initializeRoute() {
    // Try handoff data first (from Browse gallery)
    handoffData = consumeSequenceRouteHandoff();

    if (handoffData?.sequence) {
      sequence = handoffData.sequence;
      // Apply URL prop preferences even when using handoff (QR might have props)
      applyUrlPropPreferences();
      isLoading = false;
    } else if (sequenceId) {
      const parsed = parseSequenceRouteId(sequenceId);

      if (parsed.encoded) {
        try {
          let decoded = decodeSequenceWithCompression(parsed.encoded);

          decoded = await hydrateSequence(decoded, {
            letterDeriver: getLetterDeriver(),
            positionDeriver: getPositionDeriver(),
            loopDetector,
            gridModeDeriver,
          });

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
      if (isInlineEncoded(id)) {
        try {
          const decoded = decodeSequenceWithCompression(decodeURIComponent(id));
          if (decoded) {
            sequence = await hydrateSequence(decoded, {
              letterDeriver: getLetterDeriver(),
              positionDeriver: getPositionDeriver(),
              loopDetector,
              gridModeDeriver,
            });
            isLoading = false;
            return;
          }
        } catch {
          // Not a valid encoded sequence, continue
        }
      }

      const shortCodeManager = getShortCodeManager();
      let resolvedSequence = await shortCodeManager.resolveShortCode(id);

      // Fire-and-forget scan telemetry - only for genuine scans (not
      // refreshes or back/forward navigations or repeat session visits).
      const { isGenuineScan } = await import("$lib/shared/qr/utils/scan-detection");
      if (
        resolvedSequence &&
        !isInlineEncoded(id) &&
        typeof window !== "undefined" &&
        isGenuineScan(id)
      ) {
        shortCodeManager.incrementScanCount(id).catch(() => {});
        shortCodeManager.logScanEvent(id, {
          printId: new URL(window.location.href).searchParams.get("pid") || null,
          country: null,
          city: null,
          userAgent: navigator.userAgent,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          referrer: document.referrer || null,
          userId: null,
          deviceId: getDeviceId(),
        }).catch(() => {});
      }

      if (!resolvedSequence) {
        const provider = getSequenceDataProvider();
        resolvedSequence = await provider.loadByIdentifier(id);
      }

      // Try user's Firestore library (e.g. sync room IDs are Firestore doc IDs)
      if (!resolvedSequence) {
        try {
          const libraryRepo = getLibraryRepository();
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

      sequence = await hydrateSequence(resolvedSequence, {
        letterDeriver: getLetterDeriver(),
        positionDeriver: getPositionDeriver(),
        loopDetector,
        gridModeDeriver,
      });
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

  function updateUrlParam(key: string, value: string) {
    if (!browser) return;
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    replaceState(url.toString(), {});
  }
</script>

<svelte:head>
  <title>{ogWord} - TKA Composer</title>
  <meta name="description" content={ogDesc} />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="{ogWord} - TKA Composer" />
  <meta property="og:description" content={ogDesc} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:url" content={ogUrl} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{ogWord} - TKA Composer" />
  <meta name="twitter:description" content={ogDesc} />
  <meta name="twitter:image" content={ogImage} />
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
    initialRenderMode={urlRenderMode || undefined}
    handPathMode={urlHandPathMode}
    initialBlueVisible={urlInitialBlueVisible}
    initialRedVisible={urlInitialRedVisible}
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
              <!-- Mobile 3D fullscreen overlay (lazy-loaded — Three.js is 3.8MB) -->
              {#if isMobile && ctx.renderMode === '3d' && ctx.effectiveSequence}
                {#await import("$lib/shared/3d/components/Viewer3DFullscreen.svelte") then mod}
                  <mod.default
                    sequenceData={ctx.effectiveSequence}
                    currentStep={ctx.currentStepLocal}
                    isPlaying={ctx.isPlayingLocal}
                    bpm={ctx.bpmLocal}
                    word={ctx.effectiveSequence.word ?? null}
                    bluePropType={ctx.bluePropType != null ? String(ctx.bluePropType) : null}
                    redPropType={ctx.redPropType != null ? String(ctx.redPropType) : null}
                    onClose={() => ctx.viewerState.setViewerMode('animation')}
                    onPlaybackToggle={ctx.handlePlaybackToggle}
                    onBpmChange={ctx.handleBpmChange}
                    onStepForward={ctx.stepFullBeatForward}
                    onStepBackward={ctx.stepFullBeatBackward}
                  />
                {/await}
              {/if}

              <!-- Single persistent ViewerSplitPane - never destroyed, CSS grid transitions handle focus -->
              <ViewerSplitPane
                sequence={ctx.effectiveSequence}
                renderMode={isMobile ? '2d' : ctx.renderMode}
                bpm={ctx.bpmLocal}
                onBpmChange={ctx.handleBpmChange}
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
                isExportMode={isImageExportActive}
                exportOptions={ctx.exportOptions}
                onSendTo={sequence ? handleSendTo : undefined}
                onSendToStickerLab={sequence ? handleSendToStickerLab : undefined}
                stepCount={sequence?.steps?.length ?? 0}
              />
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
                      stepCount={ctx.effectiveSequence?.steps?.length ?? 0}
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
              practiceActive={ctx.practiceActive}
              onSave={() => ctx.invokeGatedAction("save", ctx.handleSave)}
              onEdit={() => ctx.invokeGatedAction("remix", ctx.handleEdit)}
              onPracticeStart={ctx.handlePracticeStart}
              onPracticeStop={ctx.handlePracticeStop}
              isOwned={ctx.isOwned}
              onDeleteRequest={() => (deleteConfirmOpen = true)}
              isSaved={ctx.isSaved}
              isPublished={ctx.isPublished}
              isFavorite={ctx.isFavorite}
              onFavorite={() => ctx.invokeGatedAction("favorite", ctx.handleFavoriteToggle)}
              onPublish={() => ctx.invokeGatedAction("publish", ctx.handlePublishAction)}
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

  /* Viewer + export panel container. */
  .viewer-and-export {
    --export-sidebar-width: 560px;
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Desktop: always a grid so the sidebar column can transition smoothly
     from 0px to 560px. Use 0px (not 0fr) - fr and px can't interpolate. */
  .viewer-and-export.desktop {
    display: grid;
    grid-template-columns: 1fr 0px;
    grid-template-rows: minmax(0, 1fr);
    transition: grid-template-columns 250ms cubic-bezier(0.2, 0, 0, 1);
  }

  /* Desktop: ViewerSplitPane participates in grid flow (not absolute) */
  .viewer-and-export.desktop :global(.view-container) {
    position: relative;
    inset: auto;
  }

  /* Desktop export active: sidebar column expands */
  .viewer-and-export.export-active.desktop {
    grid-template-columns: 1fr var(--export-sidebar-width);
  }

  /* Export panel - grid child on desktop, flex child on mobile */
  .export-panel-container {
    overflow: hidden;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    isolation: isolate;
    min-width: 0;
  }

  /* Mobile: export panel is inline in flex layout */
  @media (max-width: 767px) {
    .viewer-and-export.export-active {
      display: flex;
      flex-direction: column;
    }

    .export-panel-container {
      width: 100%;
      flex-shrink: 0;
      overflow: visible;
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }
  }

  /* Footer - CSS grid row collapse for smooth height animation.
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
